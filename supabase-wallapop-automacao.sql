-- Automação Wallapop (emails "Fizeste uma venda" / "Venda confirmada" -> encomendas do site)
-- Aplicado no Supabase pelas migrações: wallapop_automacao_base, wallapop_resolver_titulo,
-- wallapop_processar_email, wallapop_aplicar_email_prioritaria, wallapop_simular_varios, wallapop_simulacoes.
-- O código completo de cada função está no Supabase (Database > Functions):
--   wallapop_resolver_titulo(text)      escolhe a figura do site a partir do título do anúncio
--   wallapop_ligar_cliente(text, text)  encontra/cria o cliente pelo perfil Wallapop
--   wallapop_aplicar_email(jsonb)       aplica as regras (cria encomenda, passa a Pago, liga lote personalizado)
--   wallapop_processar_email(jsonb, boolean)  entrada; com p_simular = true faz e desfaz (nada fica gravado)
--   wallapop_simular_varios(jsonb)      simulação de vários emails seguidos (testes)
--   wallapop_segredo_interno()          segredo partilhado com o script do Gmail
-- Tabelas: wallapop_emails (emails tratados), wallapop_simulacoes (resultados em modo simular), wallapop_config.
-- Função online: supabase/functions/wallapop/index.ts. Script do Gmail: automacao-wallapop-gmail.gs (fora do repositório,
-- porque contém o segredo).
--
-- Regras combinadas com o Rui (04/11/2026):
--  Fizeste uma venda, anúncios normais: 1 figura -> encomenda em "Pago"; 2+ figuras -> "A aguardar pagamento" com a nota
--    "PAGO - a aguardar resposta do comprador".
--  Fizeste uma venda, "… - Lote personalizado – CÓDIGO": não cria; encontra a encomenda pelo código, liga o perfil se faltar;
--    se o comprador for outra conta, acrescenta "Comprado pela conta Wallapop <perfil>" e mantém o cliente.
--  Venda confirmada: passa para "Pago" (e retira a nota acima). Cancelada / entregue: não mexe. Nunca emite faturas.
--  Figuras: nome igual; várias fichas -> a ativa com stock; nome não exato -> a mais provável, com aviso e prioritária.
select 1;

-- =====================================================================
-- 06/11/2026 — "Venda confirmada" com a encomenda já em Pago (ou mais à frente)
-- Antes: não mexia ("sem_alteracao") e a nota "PAGO - a aguardar resposta do comprador" ficava.
-- Agora: tira só essa nota (ação "nota_tirada"), sem mudar estado nem data de pagamento.
-- Vale para lotes personalizados e vendas normais. Cópia da versão anterior em
-- wallapop_config.chave = 'backup_wallapop_aplicar_email_20261106'.
-- =====================================================================
create or replace function public.wallapop_tirar_nota_pago(t text) returns text
language sql immutable set search_path to 'public' as $f$
  select nullif(btrim(regexp_replace(coalesce(t,''), E'(^|\\n)PAGO - a aguardar resposta do comprador(\\n|$)', E'\\1', 'g'), E'\n '), '')
$f$;
-- Em wallapop_aplicar_email, nos dois ramos "confirmada":
--   else
--     update encomendas set notas_internas = wallapop_tirar_nota_pago(notas_internas)
--       where id = v_enc_id and estado <> 'Cancelado' and position(NOTA_PAGO in coalesce(notas_internas,'')) > 0;
--     v_acao := case when found then 'nota_tirada' else 'sem_alteracao' end;

-- =====================================================================
-- 07/11/2026 — Etiqueta de envio anexada sozinha + link "Abrir envio"
-- * wallapop_emails.item_hash (i= do link do email) — wallapop_aplicar_email passou a gravá-lo.
-- * obter_link_envio_wallapop_admin(p_encomenda_id) — devolve https://www.wallapop.com/delivery/timeline?b=..&i=..&r=..
--   (só admin). Usado na linha "Envio" da encomenda no site ("Abrir envio ↗").
-- * wallapop_encomenda_para_etiqueta(p_transacao, p_nome) — encomenda pelo número da venda (r=) ou,
--   se não houver, pelo nome do comprador (uma só encomenda Wallapop em Pago/Em preparação). Só service role.
-- * Função "wallapop-etiqueta" (supabase/functions/wallapop-etiqueta): recebe o PDF da extensão
--   (header x-wp-segredo) e grava-o em anexos-encomendas/<id>/<ts>-<aleatorio>-Etiqueta Wallapop - Nome.pdf;
--   procura por r=, depois código do lote, depois nome; não duplica se já houver um anexo com "etiqueta".
-- =====================================================================
alter table public.wallapop_emails add column if not exists item_hash text;
create index if not exists wallapop_emails_transacao_idx on public.wallapop_emails (transacao);

create or replace function public.obter_link_envio_wallapop_admin(p_encomenda_id bigint) returns text
language plpgsql stable security definer set search_path to 'public' as $f$
declare v record;
begin
  if not is_admin() then raise exception 'sem permissao'; end if;
  select transacao, item_hash, comprador_hash into v from wallapop_emails
   where encomenda_id = p_encomenda_id and transacao is not null
   order by (item_hash is not null) desc, recebido_em desc limit 1;
  if v.transacao is null then return null; end if;
  return 'https://www.wallapop.com/delivery/timeline?'
    || concat_ws('&', case when v.comprador_hash is not null then 'b=' || v.comprador_hash end,
                     case when v.item_hash is not null then 'i=' || v.item_hash end,
                     'r=' || v.transacao);
end $f$;
revoke all on function public.obter_link_envio_wallapop_admin(bigint) from public, anon;
grant execute on function public.obter_link_envio_wallapop_admin(bigint) to authenticated;

create or replace function public.wallapop_encomenda_para_etiqueta(p_transacao text, p_nome text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
declare v_id bigint; v_n int;
begin
  if nullif(p_transacao,'') is not null then
    select encomenda_id into v_id from wallapop_emails
     where transacao = p_transacao and encomenda_id is not null order by recebido_em desc limit 1;
    if v_id is not null then
      return (select jsonb_build_object('id', id, 'codigo', codigo_encomenda, 'estado', estado, 'por', 'transacao') from encomendas where id = v_id);
    end if;
  end if;
  if nullif(btrim(p_nome),'') is null then return jsonb_build_object('erro','sem_dados'); end if;
  select count(*), min(e.id) into v_n, v_id from encomendas e
   left join clientes_gestao c on c.id = e.cliente_gestao_id
   where e.origem ilike 'wallapop' and e.estado in ('Pago','Em preparação')
     and (lower(btrim(e.nome_cliente)) = lower(btrim(p_nome)) or lower(btrim(c.nome)) = lower(btrim(p_nome)));
  if v_n = 1 then
    return (select jsonb_build_object('id', id, 'codigo', codigo_encomenda, 'estado', estado, 'por', 'nome') from encomendas where id = v_id);
  end if;
  return jsonb_build_object('erro', case when v_n = 0 then 'nao_encontrada' else 'varias' end, 'n', v_n);
end $f$;
revoke all on function public.wallapop_encomenda_para_etiqueta(text, text) from public, anon, authenticated;

-- =====================================================================
-- 07/11/2026 — País do comprador no Wallapop
-- A função "wallapop" lê location.country_code do perfil público (api.wallapop.com/api/v3/users/<b>) e envia pais_codigo.
-- * pais_por_codigo(codigo): ES -> Espanha, PT -> Portugal, FR -> França, IT -> Itália, ... (nomes como nas fichas).
-- * wallapop_ligar_cliente(slug, nome, pais): igual ao de 2 argumentos e preenche clientes_gestao.pais só se vazio.
-- * wallapop_aplicar_email: usa-o nas vendas normais (a encomenda fica com o país da ficha) e, nos lotes,
--   preenche o país da ficha e da encomenda só se estiverem vazios. Cópia anterior em
--   wallapop_config.chave = 'backup_wallapop_aplicar_email_20261107_pais'.
-- =====================================================================
