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
