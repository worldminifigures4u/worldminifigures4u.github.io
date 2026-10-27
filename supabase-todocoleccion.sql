-- Integração com o Todocoleccion (API pública).
-- Já aplicado no Supabase em 2026-10-23 (migrations todocoleccion_lotes, todocoleccion_disparar,
-- todocoleccion_emparelhar, todocoleccion_emparelhar_v2). Guardado aqui como referência.
--
-- Segredos da edge function "todocoleccion" (Edge Functions -> Secrets):
--   TODOCOLECCION_APIKEY, TODOCOLECCION_IDUSER
-- Segredo interno (gerado na BD, no vault): todocoleccion_segredo_interno

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.todocoleccion_lotes (
  id bigint primary key,                 -- id do lote no todocoleccion
  referencia text,                       -- id_product no todocoleccion (TC<id> provisório, depois SKU)
  titulo text,
  preco numeric,
  stock integer,
  estado integer,                        -- 0 venda, 1 vendido, 4 retirado, 5 não visível
  seccao integer,
  imagem text,
  num_imagens integer,
  produto_id bigint references public.produtos(id) on delete set null,
  emparelhamento text not null default 'pendente'
    check (emparelhamento in ('pendente','certo','duvida','sem','confirmado','ignorado')),
  semelhanca real,
  sugestoes jsonb not null default '[]'::jsonb,
  detalhe_lido_em timestamptz,
  erro text,
  visto_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create index if not exists todocoleccion_lotes_produto_idx on public.todocoleccion_lotes(produto_id);
create index if not exists todocoleccion_lotes_emp_idx on public.todocoleccion_lotes(emparelhamento);

alter table public.todocoleccion_lotes enable row level security;
drop policy if exists "admin gere lotes todocoleccion" on public.todocoleccion_lotes;
create policy "admin gere lotes todocoleccion" on public.todocoleccion_lotes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'todocoleccion_segredo_interno') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'todocoleccion_segredo_interno');
  end if;
end $$;

create or replace function public.todocoleccion_segredo_interno()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'todocoleccion_segredo_interno';
$$;
revoke all on function public.todocoleccion_segredo_interno() from public, anon, authenticated;
grant execute on function public.todocoleccion_segredo_interno() to service_role;

-- Chama a edge function "todocoleccion" em segundo plano (pg_net), com o segredo interno.
create or replace function public.todocoleccion_disparar(p_corpo jsonb)
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare v_id bigint;
begin
  if not (public.is_admin() or coalesce(auth.role(),'') = 'service_role' or current_user in ('postgres','supabase_admin')) then
    raise exception 'Acesso reservado ao administrador' using errcode = '42501';
  end if;
  select net.http_post(
    url := 'https://gksndzxadndrsynvzgzb.supabase.co/functions/v1/todocoleccion',
    headers := jsonb_build_object('Content-Type','application/json','x-tc-segredo',
      (select decrypted_secret from vault.decrypted_secrets where name='todocoleccion_segredo_interno')),
    body := coalesce(p_corpo,'{}'::jsonb),
    timeout_milliseconds := 150000) into v_id;
  return v_id;
end $$;
revoke all on function public.todocoleccion_disparar(jsonb) from public, anon;
grant execute on function public.todocoleccion_disparar(jsonb) to authenticated, service_role;

create or replace function public.tc_normalizar(p text)
returns text language sql immutable set search_path = public, extensions as $$
  select trim(regexp_replace(lower(extensions.unaccent(coalesce(p,''))), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Parte o título do lote em nome + partes entre parênteses (subtema/tema)
create or replace function public.tc_titulo_partes(p_titulo text, out nome text, out extras text[])
language plpgsql immutable as $$
declare t text;
begin
  -- corta o final descritivo ("Lego compatível minifiguras", "Minifigura Figura Minifigure ... Muñeco")
  t := regexp_replace(coalesce(p_titulo,''), '\s*(lego\s+compat|minifigur).*$', '', 'i');
  select coalesce(array_agg(m[1]), array[]::text[]) into extras from regexp_matches(t, '\(([^()]*)\)', 'g') m;
  nome := trim(regexp_replace(t, '\s*\([^()]*\)', '', 'g'));
end $$;

-- Emparelha lotes com produtos: certo / duvida (3 sugestões) / sem.
-- Nunca mexe nos lotes 'confirmado' ou 'ignorado'.
create or replace function public.todocoleccion_emparelhar()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record; v_nome text; v_extras text[]; v_n text; v_ex text[];
  v_cands jsonb; v_exatos bigint[]; v_mesmo_nome bigint[]; v_melhor real; v_escolhido bigint;
  n_certo int := 0; n_duvida int := 0; n_sem int := 0;
begin
  if not (public.is_admin() or coalesce(auth.role(),'') = 'service_role' or current_user in ('postgres','supabase_admin')) then
    raise exception 'Acesso reservado ao administrador' using errcode = '42501';
  end if;

  for r in select id, titulo from todocoleccion_lotes
           where titulo is not null and emparelhamento in ('pendente','certo','duvida','sem')
  loop
    select nome, extras into v_nome, v_extras from public.tc_titulo_partes(r.titulo);
    v_n := public.tc_normalizar(v_nome);
    select coalesce(array_agg(public.tc_normalizar(e)), array[]::text[]) into v_ex from unnest(v_extras) e;

    select array_agg(p.id) into v_mesmo_nome from produtos p where public.tc_normalizar(p.nome) = v_n;
    select array_agg(p.id) into v_exatos from produtos p
     where p.id = any(coalesce(v_mesmo_nome, array[]::bigint[]))
       and (public.tc_normalizar(p.tema) = any(v_ex) or public.tc_normalizar(p.subtema) = any(v_ex));

    select coalesce(jsonb_agg(s order by (s->>'exato')::boolean desc, (s->>'semelhanca')::real desc), '[]'::jsonb),
           max((s->>'semelhanca')::real)
      into v_cands, v_melhor
    from (
      select jsonb_build_object('produto_id', p.id, 'nome', p.nome, 'tema', p.tema,
               'subtema', nullif(p.subtema,'semsubtema'), 'sku', p.sku, 'stock', p.stock,
               'imagem', (p.imagens)[1],
               'exato', public.tc_normalizar(p.nome) = v_n,
               'semelhanca', round(greatest(
                   extensions.similarity(public.tc_normalizar(p.nome), v_n),
                   extensions.similarity(
                     public.tc_normalizar(p.nome || ' ' || coalesce(p.tema,'') || ' ' || coalesce(nullif(p.subtema,'semsubtema'),'')),
                     public.tc_normalizar(v_nome || ' ' || array_to_string(v_extras,' '))))::numeric, 3)) s
      from produtos p
      order by (public.tc_normalizar(p.nome) = v_n) desc,
               extensions.similarity(public.tc_normalizar(p.nome), v_n) desc
      limit 3
    ) x;

    v_escolhido := null;
    if v_exatos is not null and cardinality(v_exatos) = 1 then
      v_escolhido := v_exatos[1];
    elsif v_exatos is null and v_mesmo_nome is not null and cardinality(v_mesmo_nome) = 1 then
      v_escolhido := v_mesmo_nome[1];
    end if;

    if v_escolhido is not null then
      update todocoleccion_lotes set produto_id = v_escolhido, emparelhamento = 'certo', semelhanca = 1, sugestoes = v_cands where id = r.id;
      n_certo := n_certo + 1;
    elsif coalesce(v_melhor,0) >= 0.35 then
      update todocoleccion_lotes set produto_id = (v_cands->0->>'produto_id')::bigint, emparelhamento = 'duvida', semelhanca = v_melhor, sugestoes = v_cands where id = r.id;
      n_duvida := n_duvida + 1;
    else
      update todocoleccion_lotes set produto_id = null, emparelhamento = 'sem', semelhanca = v_melhor, sugestoes = v_cands where id = r.id;
      n_sem := n_sem + 1;
    end if;
  end loop;

  return jsonb_build_object('certo', n_certo, 'duvida', n_duvida, 'sem', n_sem);
end $$;
revoke all on function public.todocoleccion_emparelhar() from public, anon;
grant execute on function public.todocoleccion_emparelhar() to authenticated, service_role;

-- A tabela produtos não é lida diretamente pelo login (hardening): o admin usa estas RPC.
revoke all on table public.todocoleccion_lotes from anon, authenticated;
grant select, update on table public.todocoleccion_lotes to authenticated;

create or replace function public.listar_lotes_todocoleccion_admin(p_limite integer default 1000, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) into v from (
    select l.id, l.referencia, l.titulo, l.preco, l.stock, l.estado, l.imagem, l.produto_id,
           l.emparelhamento, l.semelhanca, l.sugestoes, l.erro,
           case when p.id is null then null else jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'tema', p.tema, 'subtema', p.subtema,
             'sku', p.sku, 'stock', p.stock, 'imagens', to_jsonb(p.imagens)) end as produto
      from todocoleccion_lotes l
      left join produtos p on p.id = l.produto_id
     order by l.id
     limit least(greatest(coalesce(p_limite,1000),1),2000) offset greatest(coalesce(p_offset,0),0)
  ) x;
  return v;
end $$;

create or replace function public.procurar_produtos_todocoleccion_admin(p_texto text default null, p_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; t text := nullif(trim(coalesce(p_texto,'')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
    select jsonb_build_object('id', p.id, 'nome', p.nome, 'tema', p.tema, 'subtema', p.subtema,
             'sku', p.sku, 'stock', p.stock, 'imagens', to_jsonb(p.imagens)) x
      from produtos p
     where (p_id is not null and p.id = p_id)
        or (p_id is null and t is not null and (p.nome ilike '%' || t || '%' or p.sku ilike '%' || t || '%'))
     order by p.nome
     limit 20
  ) s;
  return v;
end $$;

revoke all on function public.listar_lotes_todocoleccion_admin(integer, integer) from public, anon;
revoke all on function public.procurar_produtos_todocoleccion_admin(text, bigint) from public, anon;
grant execute on function public.listar_lotes_todocoleccion_admin(integer, integer) to authenticated;
grant execute on function public.procurar_produtos_todocoleccion_admin(text, bigint) to authenticated;

-- ===== Atualização 2026-10-23 17:40: emparelhamento mais rápido =====
-- Substitui todocoleccion_emparelhar() por todocoleccion_emparelhar(p_so_pendentes boolean default true).
-- Por defeito só trata lotes 'pendente' (novos); é chamada pela edge function no fim de ler_detalhes.
-- Usa uma tabela temporária de produtos normalizados com índice trigram (todos os lotes em ~2 s).
drop function if exists public.todocoleccion_emparelhar();

create or replace function public.todocoleccion_emparelhar(p_so_pendentes boolean default true)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record; v_nome text; v_extras text[]; v_n text; v_ex text[]; v_alvo text;
  v_cands jsonb; v_exatos bigint[]; v_mesmo_nome bigint[]; v_melhor real; v_escolhido bigint;
  n_certo int := 0; n_duvida int := 0; n_sem int := 0;
begin
  if not (public.is_admin() or coalesce(auth.role(),'') = 'service_role' or current_user in ('postgres','supabase_admin')) then
    raise exception 'Acesso reservado ao administrador' using errcode = '42501';
  end if;

  if not exists (select 1 from todocoleccion_lotes where titulo is not null
                  and (case when p_so_pendentes then emparelhamento = 'pendente'
                            else emparelhamento in ('pendente','certo','duvida','sem') end)) then
    return jsonb_build_object('certo', 0, 'duvida', 0, 'sem', 0);
  end if;

  -- produtos normalizados uma só vez, com índice de semelhança
  drop table if exists tc_prod;
  create temp table tc_prod on commit drop as
  select p.id, p.nome, p.tema, nullif(p.subtema,'semsubtema') as subtema, p.sku, p.stock, (p.imagens)[1]::text as imagem,
         public.tc_normalizar(p.nome) as n_nome, public.tc_normalizar(p.tema) as n_tema,
         public.tc_normalizar(nullif(p.subtema,'semsubtema')) as n_sub,
         public.tc_normalizar(p.nome || ' ' || coalesce(p.tema,'') || ' ' || coalesce(nullif(p.subtema,'semsubtema'),'')) as n_tudo
    from produtos p;
  create index on tc_prod (n_nome);
  create index on tc_prod using gist (n_nome extensions.gist_trgm_ops);
  analyze tc_prod;

  for r in select id, titulo from todocoleccion_lotes
           where titulo is not null
             and (case when p_so_pendentes then emparelhamento = 'pendente'
                       else emparelhamento in ('pendente','certo','duvida','sem') end)
  loop
    select nome, extras into v_nome, v_extras from public.tc_titulo_partes(r.titulo);
    v_n := public.tc_normalizar(v_nome);
    v_alvo := public.tc_normalizar(v_nome || ' ' || array_to_string(v_extras,' '));
    select coalesce(array_agg(public.tc_normalizar(e)), array[]::text[]) into v_ex from unnest(v_extras) e;

    select array_agg(p.id) into v_mesmo_nome from tc_prod p where p.n_nome = v_n;
    select array_agg(p.id) into v_exatos from tc_prod p
     where p.n_nome = v_n and (p.n_tema = any(v_ex) or p.n_sub = any(v_ex));

    -- candidatos: os de nome exato + os 5 mais próximos pelo índice; ficam os 3 melhores
    select coalesce(jsonb_agg(s order by (s->>'exato')::boolean desc, (s->>'semelhanca')::real desc), '[]'::jsonb),
           max((s->>'semelhanca')::real)
      into v_cands, v_melhor
    from (
      select s from (
        select distinct on (c.id) c.id,
               jsonb_build_object('produto_id', c.id, 'nome', c.nome, 'tema', c.tema, 'subtema', c.subtema,
                 'sku', c.sku, 'stock', c.stock, 'imagem', c.imagem, 'exato', c.n_nome = v_n,
                 'semelhanca', round(greatest(extensions.similarity(c.n_nome, v_n),
                                              extensions.similarity(c.n_tudo, v_alvo))::numeric, 3)) s
          from (
            (select * from tc_prod p where p.n_nome = v_n)
            union all
            (select * from tc_prod p order by p.n_nome operator(extensions.<->) v_n limit 5)
          ) c
      ) d
      order by (s->>'exato')::boolean desc, (s->>'semelhanca')::real desc
      limit 3
    ) x;

    v_escolhido := null;
    if v_exatos is not null and cardinality(v_exatos) = 1 then
      v_escolhido := v_exatos[1];
    elsif v_exatos is null and v_mesmo_nome is not null and cardinality(v_mesmo_nome) = 1 then
      v_escolhido := v_mesmo_nome[1];
    end if;

    if v_escolhido is not null then
      update todocoleccion_lotes set produto_id = v_escolhido, emparelhamento = 'certo', semelhanca = 1, sugestoes = v_cands where id = r.id;
      n_certo := n_certo + 1;
    elsif coalesce(v_melhor,0) >= 0.35 then
      update todocoleccion_lotes set produto_id = (v_cands->0->>'produto_id')::bigint, emparelhamento = 'duvida', semelhanca = v_melhor, sugestoes = v_cands where id = r.id;
      n_duvida := n_duvida + 1;
    else
      update todocoleccion_lotes set produto_id = null, emparelhamento = 'sem', semelhanca = v_melhor, sugestoes = v_cands where id = r.id;
      n_sem := n_sem + 1;
    end if;
  end loop;

  return jsonb_build_object('certo', n_certo, 'duvida', n_duvida, 'sem', n_sem);
end $$;
revoke all on function public.todocoleccion_emparelhar(boolean) from public, anon;
grant execute on function public.todocoleccion_emparelhar(boolean) to authenticated, service_role;


-- 2026-10-24 (aplicado no Supabase: migration todocoleccion_referencia_produto)
-- A referência do produto do site passa a vir no produto ligado, nas sugestões e na pesquisa.
-- Ver definições atuais com: select pg_get_functiondef('public.listar_lotes_todocoleccion_admin(integer,integer)'::regprocedure);

-- ===== Portes 2026-10-25 (não é Todocoleccion; registado aqui por conveniência) =====
-- CTT Azul Internacional passa a "com seguimento" e o cliente vê "CTT com seguimento".
-- Espanha/Europa: Azul Internacional ativo (6,95 / 9,29 / 12,05 / 16,24 / 26,08), CTT Registado desativado.
alter table public.portes_metodos add column if not exists nome_cliente text;
update public.portes_metodos set registado = true, nome_cliente = 'CTT com seguimento' where id = 'ctt_azul_internacional';
-- InPost: nome "InPost com seguimento" no carrinho e no admin (id continua inpost_registado).
update public.portes_metodos set nome_exibicao = 'InPost com seguimento' where id = 'inpost_registado';
update public.portes_tarifas set nome_exibicao = 'InPost com seguimento' where metodo_id = 'inpost_registado';
update public.encomendas set metodo_envio_nome = 'InPost com seguimento' where metodo_envio_nome = 'InPost Registado';

-- ============================================================
-- Preço próprio do Todocoleccion (26/10/2026)
-- Regra: preço venda x 1,10, arredondado para cima aos 5 cêntimos, mínimo 1,95 €.
-- produtos.preco_todocoleccion (opcional) sobrepõe-se à regra.
-- listar_produtos_mapas_admin devolve preco_todocoleccion e preco_todocoleccion_regra;
-- editar_produto_admin_v2 grava preco_todocoleccion só se a chave vier no JSON (vazio = null).
-- ============================================================
alter table public.produtos add column if not exists preco_todocoleccion numeric;

create or replace function public.tc_preco_regra(p_preco numeric) returns numeric language sql immutable as $$
  select greatest(1.95, ceil(round(coalesce(p_preco,0) * 1.10, 4) / 0.05) * 0.05)::numeric(10,2);
$$;

create or replace function public.tc_preco_produto(p_produto public.produtos) returns numeric language sql stable as $$
  select coalesce(p_produto.preco_todocoleccion, public.tc_preco_regra(p_produto.preco::numeric))::numeric(10,2);
$$;

-- ============================================================
-- Sincronização de stock site -> todocoleccion (26/10/2026)
-- Regra: lote à venda só se o produto tiver stock > 0.
-- Trigger em produtos.stock chama a edge function (acao sincronizar_estado) quando o stock
-- passa de >0 para <=0 ou ao contrário. Também corre no fim de cada "Atualizar do Todocoleccion".
-- ============================================================
create or replace function public.todocoleccion_lotes_sincronizar(p_produtos bigint[] default null)
returns table(id bigint, referencia text, acao text)
language sql stable security definer set search_path = public as $$
  select l.id, l.referencia,
         case when l.estado = 0 then 'retirar' else 'reativar' end
  from todocoleccion_lotes l join produtos p on p.id = l.produto_id
  where l.emparelhamento = 'confirmado' and l.referencia is not null
    and (p_produtos is null or p.id = any(p_produtos))
    and ((l.estado = 0 and coalesce(p.stock,0) <= 0) or (l.estado = 4 and coalesce(p.stock,0) > 0))
  order by l.id;
$$;
revoke all on function public.todocoleccion_lotes_sincronizar(bigint[]) from public, anon, authenticated;

create or replace function public.produtos_tc_sincronizar_stock()
returns trigger language plpgsql security definer set search_path = public, vault, net as $$
begin
  if (coalesce(old.stock,0) > 0) is distinct from (coalesce(new.stock,0) > 0)
     and exists (select 1 from todocoleccion_lotes l where l.produto_id = new.id and l.emparelhamento = 'confirmado') then
    begin
      perform net.http_post(
        url := 'https://gksndzxadndrsynvzgzb.supabase.co/functions/v1/todocoleccion',
        headers := jsonb_build_object('Content-Type','application/json','x-tc-segredo',
          (select decrypted_secret from vault.decrypted_secrets where name='todocoleccion_segredo_interno')),
        body := jsonb_build_object('acao','sincronizar_estado','produtos', jsonb_build_array(new.id)),
        timeout_milliseconds := 150000);
    exception when others then
      raise warning 'todocoleccion: sincronização de stock falhou para o produto %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;
revoke all on function public.produtos_tc_sincronizar_stock() from public, anon, authenticated;

drop trigger if exists produtos_tc_sincronizar_stock on public.produtos;
create trigger produtos_tc_sincronizar_stock
  after update of stock on public.produtos
  for each row execute function public.produtos_tc_sincronizar_stock();

-- ============================================================
-- Importação das encomendas do todocoleccion (26/10/2026)
-- Edge function acao importar_encomendas (modo "base" marcou as 218 antigas como já registadas).
-- Corre a cada 10 min (pg_cron). Cria a encomenda (origem Todocoleccion, referencia_externa = nº da encomenda TC),
-- desce o stock (pode ficar negativo: a venda já aconteceu) e liga o lote republicado ao produto.
-- Paga no TC -> passa de "A aguardar pagamento" a "Em preparação".
-- Ver a versão completa das funções na migração todocoleccion_encomendas_importacao.
-- ============================================================
-- tabela: public.todocoleccion_encomendas(id_order pk, data_encomenda, total, comprador, estado_tc, encomenda_id,
--         situacao [importada|ja_registada|anulada|erro], erro, itens, visto_em, criado_em)
-- função: public.todocoleccion_criar_encomenda(p jsonb)  (só service_role)
-- create extension if not exists pg_cron;
-- select cron.schedule('todocoleccion-importar-encomendas', '*/10 * * * *',
--   $$select public.todocoleccion_disparar('{"acao":"importar_encomendas"}'::jsonb)$$);

create table if not exists public.todocoleccion_encomendas (
  id_order bigint primary key,
  data_encomenda timestamptz,
  total numeric,
  comprador text,
  estado_tc text,
  encomenda_id bigint references public.encomendas(id) on delete set null,
  situacao text not null check (situacao in ('importada','ja_registada','anulada','erro')),
  erro text,
  itens jsonb,
  visto_em timestamptz default now(),
  criado_em timestamptz default now()
);
alter table public.todocoleccion_encomendas enable row level security;
create policy "admin le encomendas tc" on public.todocoleccion_encomendas for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.todocoleccion_encomendas from anon, authenticated;
-- (função todocoleccion_criar_encomenda: ver migração no Supabase)

-- ============================================================
-- Stock exato no todocoleccion (26/10/2026)
-- A gestão de stock está ativa na conta (confirmado pelo suporte). O GET devolve o campo "stock " (com espaço).
-- O lote no TC passa a ter as mesmas unidades que o site; à venda só com stock > 0.
-- O trigger envia qualquer mudança de stock (não só a passagem pelo 0).
-- ============================================================
create or replace function public.todocoleccion_lotes_sincronizar_v2(p_produtos bigint[] default null)
returns table(id bigint, referencia text, estado integer, stock_tc integer, alvo integer)
language sql stable security definer set search_path = public as $$
  select l.id, l.referencia, l.estado, l.stock, greatest(coalesce(p.stock,0),0)
  from todocoleccion_lotes l join produtos p on p.id = l.produto_id
  where l.emparelhamento = 'confirmado' and l.referencia is not null and l.estado in (0,4)
    and (p_produtos is null or p.id = any(p_produtos))
    and (l.stock is distinct from greatest(coalesce(p.stock,0),0)
         or (l.estado = 0 and coalesce(p.stock,0) <= 0) or (l.estado = 4 and coalesce(p.stock,0) > 0))
  order by (l.estado = 0 and coalesce(p.stock,0) <= 0) desc, l.id;
$$;
revoke all on function public.todocoleccion_lotes_sincronizar_v2(bigint[]) from public, anon, authenticated;
-- produtos_tc_sincronizar_stock(): a condição passa a ser
--   coalesce(old.stock,0) is distinct from coalesce(new.stock,0)

-- ===== 2026-10-27: títulos e descrições em espanhol =====
alter table todocoleccion_lotes add column if not exists descricao_versao text;
create table if not exists todocoleccion_titulos_novos (lote_id bigint primary key, tema text, base text, titulo_atual text, titulo_novo text, aplicado_em timestamptz, erro text, tentativas int not null default 0);
alter table todocoleccion_titulos_novos enable row level security;

create table if not exists todocoleccion_trad (ordem serial, tema text, de text, para text, inicio boolean default false, alvo text default 'nome');
alter table todocoleccion_trad enable row level security;
truncate todocoleccion_trad;
insert into todocoleccion_trad (tema, de, para, inicio) values
-- Marvel (nome em inglês + nome em Espanha)
('Marvel','Spider-Man','Spider-Man Hombre Araña',true),
('Marvel','Spider-Gwen','Spider-Gwen Spider-Woman',true),
('Marvel','Black Widow','Black Widow Viuda Negra',true),
('Marvel','Black Panther','Black Panther Pantera Negra',true),
('Marvel','Captain America','Capitán América',true),
('Marvel','Captain Marvel','Capitana Marvel',true),
('Marvel','Captain Carter','Capitana Carter',true),
('Marvel','Green Goblin','Green Goblin Duende Verde',true),
('Marvel','Doctor Doom','Doctor Doom Doctor Muerte',true),
('Marvel','Doctor Strange','Doctor Extraño Strange',true),
('Marvel','Hawkeye','Hawkeye Ojo de Halcón',true),
('Marvel','Human Torch','Antorcha Humana',true),
('Marvel','Invisible Woman','Mujer Invisible',true),
('Marvel','Mister Fantastic','Mister Fantástico',true),
('Marvel','The Thing','La Cosa The Thing',true),
('Marvel','Scarlet Witch','Bruja Escarlata',true),
('Marvel','Winter Soldier','Soldado de Invierno',true),
('Marvel','Ghost Rider','Ghost Rider Motorista Fantasma',true),
('Marvel','Iron Fist','Iron Fist Puño de Hierro',true),
('Marvel','Punisher','Punisher Castigador',true),
('Marvel','Storm','Tormenta Storm',true),
('Marvel','Cyclops','Cíclope Cyclops',true),
('Marvel','Beast','Bestia Beast',true),
('Marvel','Iceman','Iceman Hombre de Hielo',true),
('Marvel','Nightcrawler','Rondador Nocturno Nightcrawler',true),
('Marvel','Mystique','Mística Mystique',true),
('Marvel','Rogue','Pícara Rogue',true),
('Marvel','Sabretooth','Dientes de Sable',true),
('Marvel','Silver Surfer','Estela Plateada Silver Surfer',true),
('Marvel','Red Skull','Cráneo Rojo Red Skull',true),
('Marvel','Iron Skull','Cráneo de Hierro Iron Skull',true),
('Marvel','Lizard','Lagarto Lizard',true),
('Marvel','Vulture','Buitre Vulture',true),
('Marvel','Rhino','Rino Rhino',true),
('Marvel','Sandman','Hombre de Arena Sandman',true),
('Marvel','Scorpion','Escorpión Scorpion',true),
('Marvel','Wasp','Avispa Wasp',true),
('Marvel','Vision','Visión Vision',true),
('Marvel','White Vision','Visión Blanca',true),
('Marvel','Valkyrie','Valquiria',true),
('Marvel','War Machine','War Machine Máquina de Guerra',true),
('Marvel','Falcon -','Falcon Halcón',true),
('Marvel','Falcon','Falcon Halcón',true),
('Marvel','She-Hulk','She-Hulk Hulka',true),
('Marvel','Red She-Hulk','Hulka Roja Red She-Hulk',true),
('Marvel','Red Hulk','Hulk Rojo Red Hulk',true),
('Marvel','Grey Hulk','Hulk Gris',true),
('Marvel','Ant-Man','Ant-Man Hombre Hormiga',true),
('Marvel','Professor X','Profesor X',true),
('Marvel','Moon Knight','Moon Knight Caballero Luna',true),
('Marvel','Dark Phoenix','Fénix Oscura Dark Phoenix',true),
('Marvel','White Phoenix','Fénix Blanca',true),
('Marvel','Phoenix','Fénix Phoenix',true),
('Marvel','Archangel','Arcángel Archangel',true),
('Marvel','Colossus','Coloso Colossus',true),
('Marvel','The Collector','El Coleccionista',true),
('Marvel','The Ancient One','El Anciano Ancient One',true),
('Marvel','The Hand Ninja','Ninja de La Mano',true),
('Marvel','Quicksilver','Mercurio Quicksilver',true),
('Marvel','Red Guardian','Guardián Rojo',true),
('Marvel','White Queen','Reina Blanca Emma Frost',true),
('Marvel','Mole Man','Hombre Topo',true),
('Marvel','Molten Man','Hombre Fundido Molten Man',true),
('Marvel','Chameleon','Camaleón',true),
('Marvel','Executioner','Verdugo Executioner',true),
('Marvel','Count Nefaria','Conde Nefaria',true),
('Marvel','Kraven the Hunter','Kraven el Cazador',true),
('Marvel','Kang the Conquerer','Kang el Conquistador',true),
('Marvel','Gorr the God Butcher','Gorr el Carnicero de Dioses',true),
('Marvel','High Evolutionary','Alto Evolucionador',true),
('Marvel','Crimson Dynamo','Dínamo Carmesí',true),
('Marvel','Wolverine -','Wolverine Lobezno',true),
('Marvel','Wolverine','Wolverine Lobezno',true),
('Marvel','Peter Quill','Peter Quill Star-Lord',true),
('Marvel','Rocket Raccoon','Rocket Mapache',true),
('Marvel','Groot Jovem','Groot Joven Baby Groot',true),
('Marvel','Amora ”Enchantress”','Amora Encantadora',true),
('Marvel','Viper ”Madame Hydra”','Víbora Madame Hydra',true),
('Marvel','Sylvie “Lady Loki”','Sylvie Lady Loki',true),
('Marvel','Hydra Henchman','Secuaz de Hydra',true),
('Marvel','Mr. Negative’s Henchman','Secuaz de Mr. Negative',true),
('Marvel','Lucky o cão pizza','Lucky el perro pizza',false),
('Marvel','Black & Gold Suit','Traje Negro y Dorado',false),
('Marvel','Symbiote Suit','Traje Simbionte',false),
('Marvel','Black Suit','Traje Negro',false),
('Marvel','com mota','con moto',false),
-- DC
('DC','Wonder Woman','Wonder Woman Mujer Maravilla',true),
('DC','Green Lantern','Green Lantern Linterna Verde',true),
('DC','Green Arrow','Green Arrow Flecha Verde',true),
('DC','Riddler','Riddler Enigma',true),
('DC','Penguin','Pingüino Penguin',true),
('DC','Two-Face','Dos Caras Two-Face',true),
('DC','Poison Ivy','Poison Ivy Hiedra Venenosa',true),
('DC','Scarecrow','Espantapájaros Scarecrow',true),
('DC','Martian Manhunter','Detective Marciano Martian Manhunter',true),
('DC','Captain Cold','Capitán Frío Captain Cold',true),
('DC','Blue Beetle','Escarabajo Azul Blue Beetle',true),
('DC','Plastic Man','Hombre Plástico Plastic Man',true),
('DC','Red Hood','Capucha Roja Red Hood',true),
('DC','Red Arrow','Flecha Roja Red Arrow',true),
('DC','Atom','Átomo Atom',true),
('DC','Ocean Master','Amo del Océano Ocean Master',true),
('DC','White Canary','Canario Blanco White Canary',true),
('DC','White Lantern','Linterna Blanca',true),
('DC','Peacemaker','Peacemaker Pacificador',true),
('DC','Doctor Fate','Doctor Fate Destino',true),
('DC','Condiment King','Rey de los Condimentos',true),
('DC','Joker Henchman','Secuaz del Joker',true),
('DC','Calculator','Calculadora Calculator',true),
('DC','Egghead','Cabeza de Huevo Egghead',true),
-- Star Wars
('Star Wars','Admiral','Almirante',true),
('Star Wars','Emperor','Emperador',true),
('Star Wars','Captain','Capitán',true),
('Star Wars','Commander','Comandante',true),
('Star Wars','Grand Inquisitor','Gran Inquisidor',true),
('Star Wars','Grand Moff','Gran Moff',true),
('Star Wars','Supreme Leader Snoke','Líder Supremo Snoke',true),
('Star Wars','The Armorer','La Armera The Armorer',true),
('Star Wars','Mother Talzin','Madre Talzin',true),
('Star Wars','Daughter of Mortis','Hija de Mortis',true),
('Star Wars','The Son of Mortis','Hijo de Mortis',true),
('Star Wars','Mortis The Father','Padre de Mortis',true),
('Star Wars','Abeloth The Mother','Abeloth la Madre',true),
('Star Wars','Royal Guard','Guardia Real Royal Guard',true),
('Star Wars','Naboo Guard','Guardia de Naboo',true),
('Star Wars','Jedi Temple Guard','Guardia del Templo Jedi',true),
('Star Wars','Queen Amidala','Reina Amidala',true),
('Star Wars','Lieutenant','Teniente',true),
('Star Wars','Mandalorian','Mandaloriano Mandalorian',true),
('Star Wars','Hologram','Holograma',false),
('Star Wars','Pilot','Piloto',false),
-- O Senhor dos Anéis
('O Senhor dos Anéis','Carneiro montada dos Anões','Carnero montura de los Enanos',false),
('O Senhor dos Anéis','Javali montada dos Anões','Jabalí montura de los Enanos',false),
('O Senhor dos Anéis','Cavalo Nazgûl','Caballo Nazgûl',false),
('O Senhor dos Anéis','sela castanha','silla marrón',false),
('O Senhor dos Anéis','sela cinzenta','silla gris',false),
('O Senhor dos Anéis','Gandalf o Branco','Gandalf el Blanco',false),
('O Senhor dos Anéis','Gandalf o Cinzento','Gandalf el Gris',false),
('O Senhor dos Anéis','Guerreiro Anão','Guerrero Enano',false),
('O Senhor dos Anéis','Mestre da Cidade do Lago','Gobernador de la Ciudad del Lago',false),
('O Senhor dos Anéis','O Senhor dos Nazgûl','Señor de los Nazgûl',false),
('O Senhor dos Anéis','Rei Bruxo de Angmar','Rey Brujo de Angmar',false),
('O Senhor dos Anéis','Rei dos Mortos','Rey de los Muertos',false),
('O Senhor dos Anéis','Soldado dos Mortos','Soldado de los Muertos',false),
('O Senhor dos Anéis','the Dwarf - Aged','el Enano Anciano',false),
('O Senhor dos Anéis','the Dwarf','el Enano',false),
('O Senhor dos Anéis','Elf Archer','Arquero Elfo',false),
('O Senhor dos Anéis','Elf Guard','Guardia Elfo',false),
('O Senhor dos Anéis','Elf Warrior','Guerrero Elfo',false),
('O Senhor dos Anéis','Cave Troll','Troll de las Cavernas',false),
('O Senhor dos Anéis','Goblin King','Rey Goblin',false),
('O Senhor dos Anéis','Bain Son of Bard','Bain hijo de Bardo',false),
('O Senhor dos Anéis','Bard the Bowman','Bardo el Arquero',false),
('O Senhor dos Anéis','Thorin Oakenshield','Thorin Escudo de Roble',false),
('O Senhor dos Anéis','Bilbo Baggins','Bilbo Bolsón',false),
('O Senhor dos Anéis','Frodo Baggins','Frodo Bolsón',false),
('O Senhor dos Anéis','Samwise Gamgee','Sam Gamyi Samwise',false),
('O Senhor dos Anéis','Dáin II Ironfoot','Dáin II Pie de Hierro',false),
-- Filmes e Séries
('Filmes e Séries','Eduardo Mãos de Tesoura','Eduardo Manostijeras',false),
('Filmes e Séries','Fantasma - brilha no escuro','Fantasma brilla en la oscuridad',false),
('Filmes e Séries','Múmia','Momia',false),
('Filmes e Séries','Predador','Depredador Predator',false),
('Filmes e Séries','Jack the Ripper','Jack el Destripador',false),
('Filmes e Séries','The Mask','La Máscara The Mask',false),
('Filmes e Séries','Pennywise Clown','Pennywise payaso',false),
('Filmes e Séries','Art the Clown','Art el payaso',false),
('Filmes e Séries','Esqueleto Mexicano','Esqueleto Mexicano Catrín',false),
('Filmes e Séries','Monkey King','Rey Mono Monkey King',false),
('Filmes e Séries','DeLorean Time Machine','DeLorean máquina del tiempo',false),
-- Cidade
('Cidade','Bombeiro','Bombero',false),
('Cidade','Boneco de Neve','Muñeco de Nieve',false),
('Cidade','Canoísta','Piragüista',false),
('Cidade','Casal de Turistas com cão','Pareja de Turistas con perro',false),
('Cidade','Dançarina Oriental','Bailarina Oriental',false),
('Cidade','Empresário','Empresario',false),
('Cidade','Gangster Machados','Gánster con hachas',false),
('Cidade','Jóquei','Jockey',false),
('Cidade','Lutador Artes Marciais','Luchador de Artes Marciales',false),
('Cidade','Mergulhador','Buceador',false),
('Cidade','Party Clown','Payaso de fiesta',false),
('Cidade','Polícia com Pistola e Algemas','Policía con Pistola y Esposas',false),
('Cidade','Prisioneiro','Prisionero',false),
('Cidade','Quebra-Nozes','Cascanueces',false),
('Cidade','Rapariga com Vespa','Chica con Vespa',false),
('Cidade','Universitário','Universitario',false),
('Cidade','Wrestler','Luchador Wrestler',false),
('Cidade','Boxer','Boxeador',false),
-- Animais
('Animais','Cavalo','Caballo',false),
('Animais','sela amarela','silla amarilla',false),
('Animais','sela castanha','silla marrón',false),
('Animais','Castanho','Marrón',false),
('Animais','Branco','Blanco',false),
('Animais','Creme','Crema',false),
('Animais','Tubarão','Tiburón',false),
-- Disney
('Disney','Ió','Igor Eeyore',false),
('Disney','Margarida','Daisy',false),
('Disney','Pateta','Goofy',false),
('Disney','Teco','Chop',false),
('Disney','Tico','Chip',false),
('Disney','Tio Patinhas','Tío Gilito',false),
('Disney','Ursinho Pooh','Winnie the Pooh',false),
-- Diversos
('Diversos','Pai Natal','Papá Noel',false),
('Diversos','Gingerbread Man','Hombre de Jengibre',false),
-- Dragon Ball
('Dragon Ball','Tartaruga Genial','Maestro Roshi Muten Roshi',false),
('Dragon Ball','Freeza','Freezer',false),
('Dragon Ball','Grand Priest','Gran Sacerdote',false),
-- Faroeste
('Faroeste','Carroça de Cowboys Faroeste compatível com lego','Carreta de Vaqueros',false),
('Faroeste','Chefe Índio','Jefe Indio',false),
('Faroeste','Índio Apache','Indio Apache',false),
('Faroeste','Viajante do Faroeste','Viajero del Oeste',false),
('Faroeste','Xerife','Sheriff',false),
('Faroeste','Cowboy','Vaquero Cowboy',false),
-- Futebol
('Futebol','Croácia','Croacia',false),
('Futebol','Espanha','España',false),
('Futebol','Neymar Júnior','Neymar Jr',false),
('Futebol','Vinicius Júnior','Vinicius Jr',false),
-- Harry Potter
('Harry Potter','Cedrico','Cedric',false),
('Harry Potter','Cerberus Fluffy Three-Headed Dog','Fluffy perro de tres cabezas',false),
('Harry Potter','Moaning Myrtle','Myrtle la Llorona',false),
('Harry Potter','Sir Nicholas Nearly Headless Nick','Nick Casi Decapitado',false),
('Harry Potter','Mad-Eye Moody','Ojoloco Moody',false),
-- Masters
('Masters of the Universe','Sorceress','Hechicera Sorceress',false),
('Masters of the Universe','Beast Man','Beast Man Hombre Bestia',false),
-- Medieval
('Medieval','Cavaleiro Templário','Caballero Templario',false),
('Medieval','Grão-Mestre Ordem Teutónica','Gran Maestre de la Orden Teutónica',false),
('Medieval','Rei','Rey',false),
('Medieval','Teutonic Knight','Caballero Teutónico',false),
('Medieval','Evil Dwarf','Enano Malvado',false),
('Medieval','Golden Knight','Caballero Dorado',false),
('Medieval','Viking','Vikingo',false),
-- Militar
('Militar','Figura Adolf Hitler','Adolf Hitler',false),
('Militar','British Imperial Soldier Red Coat','Soldado Británico Casaca Roja',false),
('Militar','French Cuirassier','Coracero Francés',false),
('Militar','Fuzileiro Britânico','Fusilero Británico',false),
('Militar','Grenadier of the Old Guard','Granadero de la Vieja Guardia',false),
('Militar','Guarda de Honra Alemão','Guardia de Honor Alemán',false),
('Militar','Guerrilheiro Árabe','Guerrillero Árabe',false),
('Militar','Hamleys Royal Guard','Guardia Real británica Hamleys',false),
('Militar','Napoleon Bonaparte','Napoleón Bonaparte',false),
('Militar','North Vietnamese Soldier','Soldado Norvietnamita',false),
('Militar','Russian Line Infantry','Infantería de Línea Rusa',false),
('Militar','Scottish Bagpiper','Gaitero Escocés',false),
('Militar','Soldado Alemão','Soldado Alemán',false),
('Militar','Soldado Britânico','Soldado Británico',false),
('Militar','Soldado Confederado - Sul','Soldado Confederado Sur',false),
('Militar','Soldado Japonês','Soldado Japonés',false),
('Militar','Soldado Soviético Infantaria','Soldado Soviético Infantería',false),
('Militar','Soldado União - Norte','Soldado de la Unión Norte',false),
('Militar','Soldado USA','Soldado Americano USA',false),
-- One Piece
('One Piece','Kaido das Cem Feras','Kaido de las Cien Bestias',false),
('One Piece','Whitebeard','Barbablanca Whitebeard',false),
('One Piece','Blackbeard','Barbanegra Blackbeard',false),
-- Simpsons
('Os Simpsons','Palhaço Krusty','Krusty el Payaso',false),
('Os Simpsons','Grampa','Abuelo Simpson',false),
('Os Simpsons','Chief Wiggum','Jefe Wiggum',false),
('Os Simpsons','Groundskeeper Willie','Willie el jardinero',false),
('Os Simpsons','Comic Book Guy','Dependiente de la tienda de cómics',false),
('Os Simpsons','Santa''s Little Helper','Ayudante de Santa Claus',false),
('Os Simpsons','Snowball','Bola de Nieve',false),
('Os Simpsons','Mr. Burns','Sr. Burns',false),
-- Piratas
('Piratas das Caraíbas','Mermaid Syrena','Sirena Syrena',false),
('Piratas das Caraíbas','Captain Salazar','Capitán Salazar',false),
('Piratas das Caraíbas','Blackbeard','Barbanegra',false),
('Piratas das Caraíbas','Lieutenant','Teniente',false),
('Piratas das Caraíbas','Officer','Oficial',false),
('Piratas das Caraíbas','Jack Sparrow','Capitán Jack Sparrow',false),
-- Rua Sésamo
('Rua Sésamo','Becas','Epi Ernie',false),
('Rua Sésamo','Egas','Blas Bert',false),
('Rua Sésamo','Monstro das Bolachas','Monstruo de las Galletas',false),
('Rua Sésamo','Óscar O Resmungão','Óscar el Gruñón',false),
('Rua Sésamo','Poupas','Paco Pico Big Bird',false),
-- Stranger Things
('Stranger Things','Câmara Fotográfica','Cámara Fotográfica',false),
('Stranger Things','Cassete','Casete',false),
('Stranger Things','Xerife','Sheriff',false),
('Stranger Things','Pink Dress','Vestido Rosa',false),
('Stranger Things','Season 5','Temporada 5',false),
-- Tempos Antigos
('Tempos Antigos','Atlantis Portal Emperor','Emperador del Portal de la Atlántida',false),
('Tempos Antigos','British Royal Navy Soldier','Soldado de la Marina Real Británica',false),
('Tempos Antigos','Canibal','Caníbal',false),
('Tempos Antigos','Centurião Romano','Centurión Romano',false),
('Tempos Antigos','Deusa Athena','Diosa Atenea',false),
('Tempos Antigos','Faraó do Egipto','Faraón de Egipto',false),
('Tempos Antigos','Frontiersman','Pionero del Oeste',false),
('Tempos Antigos','Greek Hoplite','Hoplita Griego',false),
('Tempos Antigos','Mosqueteiro','Mosquetero',false),
('Tempos Antigos','Rainha do Egito','Reina de Egipto',false),
('Tempos Antigos','Rainha Múmia','Reina Momia',false),
-- Toy Story
('Toy Story','Alien Little Green Men','Marciano Alien',false),
('Toy Story','Bullseye Horse','Perdigón caballo Bullseye',false),
('Toy Story','Emperor Zurg','Emperador Zurg',false),
('Toy Story','Stinky Pete','Pete el Apestoso',false),
-- Animação
('Animação','Golden Ninja','Ninja Dorado Golden Ninja',false),
-- Geral (todos os temas)
(null,'Guerreiro','Guerrero',false),
(null,'Clássico','Clásico',false),
(null,'Clássica','Clásica',false),
(null,'Classic Standard','Clásico',false),
(null,'Classic','Clásico',false),
(null,'Comics','Cómic',false),
(null,'Jovem','Joven',false),
(null,'Young','Joven',false),
(null,'Aged','Anciano',false),
(null,'Transformação','Transformación',false),
(null,'Branco','Blanco',false),
(null,'Creme','Crema',false),
(null,'Filme Lego','Película',false),
(null,'Senador','Senador',false),
(null,'e','y',false);

-- Subtemas (conteúdo dos parênteses)
insert into todocoleccion_trad (tema, de, para, alvo) values
(null,'Guardiões da Galáxia','Guardianes de la Galaxia','sub'),
(null,'Guardiões da Galaxia','Guardianes de la Galaxia','sub'),
(null,'Guardians of the Galaxy','Guardianes de la Galaxia','sub'),
(null,'Avengers','Vengadores Avengers','sub'),
(null,'Fantastic 4','4 Fantásticos','sub'),
(null,'Fantastic Four','4 Fantásticos','sub'),
(null,'Segunda Guerra Mundial WW2','Segunda Guerra Mundial','sub'),
(null,'WW2 Segunda Guerra Mundial','Segunda Guerra Mundial','sub'),
(null,'WW2','Segunda Guerra Mundial','sub'),
(null,'Guerra Civil Americana','Guerra de Secesión','sub'),
(null,'Tico e Teco','Chip y Chop','sub'),
(null,'Regresso ao Futuro','Regreso al Futuro','sub'),
(null,'Back to the Future','Regreso al Futuro','sub'),
(null,'Caça-Fantasmas','Cazafantasmas Ghostbusters','sub'),
(null,'Ghostbusters','Cazafantasmas Ghostbusters','sub'),
(null,'Dia dos Mortos','Día de Muertos','sub'),
(null,'O Silêncio dos Inocentes','El Silencio de los Corderos','sub'),
(null,'Sexta-feira 13','Viernes 13','sub'),
(null,'A Nightmare on Elm Street','Pesadilla en Elm Street','sub'),
(null,'The Texas Chainsaw Massacre','La Matanza de Texas','sub'),
(null,'The Shining','El Resplandor','sub'),
(null,'The Nightmare Before Christmas','Pesadilla antes de Navidad','sub'),
(null,'Child''s Play','Muñeco Diabólico','sub'),
(null,'The Conjuring','Expediente Warren','sub'),
(null,'Aliens','Aliens el regreso','sub'),
(null,'Steven Spielberg','el Extraterrestre','sub'),
(null,'Tom & Jerry','Tom y Jerry','sub'),
(null,'Sonic','Sonic the Hedgehog','sub');

-- Subtemas genéricos que não entram no título
create table if not exists todocoleccion_sub_ignorar (sub text primary key);
alter table todocoleccion_sub_ignorar enable row level security;
insert into todocoleccion_sub_ignorar values ('Filmes e Séries'),('Animais'),('Cidade'),('Antiguidade'),('Tempos Antigos'),('Medieval'),('Militar'),('Famosos'),('Futebol'),('Jogos'),('Uniformes'),('Dinossauros'),
('Star Wars'),('Marvel'),('DC'),('DC Comics'),('Dragon Ball'),('One Piece'),('Harry Potter'),('Stranger Things'),('NBA'),('Disney'),('Toy Story'),('Image Comics'),
('Os Simpsons'),('Piratas das Caraíbas'),('Rua Sésamo'),('Tartarugas Ninja'),('O Senhor dos Anéis'),('O Senhor dos Aneis'),('Masters of the Universe'),('Faroeste')
on conflict do nothing;

insert into todocoleccion_trad (tema, de, para, inicio) values
('Marvel','BD','Cómic',false),('DC','BD','Cómic',false),
('Marvel','Captain América','Capitán América',true),
('Tempos Antigos','Guerreiro Escocês','Guerrero Escocés',false),
(null,'Professor','Profesor',false),
('Star Wars','Leia Organa Aged','Leia Organa Anciana',false);

create or replace function public.tc_esc(t text) returns text language sql immutable set search_path = '' as $$ select regexp_replace(t, '([.\-+*?()\[\]^$|\\{}])', '\\\1', 'g') $$;

create or replace function public.tc_titulo_es(p_tema text, p_base text) returns text language plpgsql set search_path = public as $$
declare
  nome text; subs text[] := '{}'; s text; m text[]; extra text := ''; kw text; r record; sub_es text; partes text[] := '{}'; t text; pref text := 'Minifigura'; feito boolean := false;
begin
  nome := p_base;
  for m in select regexp_matches(nome, '[\(\[]([^\)\]]*cm)[\)\]]', 'g') loop extra := extra || ' (' || replace(m[1], ' x ', 'x') || ')'; end loop;
  nome := regexp_replace(nome, '[\(\[][^\)\]]*cm[\)\]]', ' ', 'g');
  for m in select regexp_matches(nome, '\(([^)]*)\)', 'g') loop subs := subs || trim(m[1]); end loop;
  nome := regexp_replace(nome, '\([^)]*\)', ' ', 'g');
  nome := regexp_replace(nome, '\s+(minifiguras?|Minifigura Figura Minifigure.*|BO09)\s*$', '', 'i');
  nome := trim(regexp_replace(nome, '\s+', ' ', 'g'));
  nome := regexp_replace(nome, '\s+-\s*$', '');
  for r in select * from todocoleccion_trad where alvo='nome' and (tema = p_tema) order by inicio desc, length(de) desc, ordem loop
    if r.inicio then
      if not feito and nome ~* ('^' || tc_esc(r.de) || '(\s|$)') then nome := r.para || substr(nome, length(r.de) + 1); feito := true; end if;
    else
      nome := regexp_replace(nome, '(^|\s)' || tc_esc(r.de) || '(?=\s|$|,)', '\1' || r.para, 'g');
    end if;
  end loop;
  for r in select * from todocoleccion_trad where alvo='nome' and tema is null order by length(de) desc, ordem loop
    nome := regexp_replace(nome, '(^|\s)' || tc_esc(r.de) || '(?=\s|$|,)', '\1' || r.para, 'g');
  end loop;
  nome := trim(regexp_replace(regexp_replace(nome, '\s+-\s+', ' ', 'g'), '\s+', ' ', 'g'));
  foreach s in array subs loop
    if exists (select 1 from todocoleccion_sub_ignorar where sub = s) then continue; end if;
    select para into sub_es from todocoleccion_trad where alvo='sub' and de = s limit 1;
    if not (coalesce(sub_es, s) = any(partes)) then partes := partes || coalesce(sub_es, s); end if;
  end loop;
  kw := case p_tema
    when 'Star Wars' then 'Star Wars' when 'Marvel' then 'Marvel' when 'DC' then 'DC Comics'
    when 'O Senhor dos Anéis' then 'El Señor de los Anillos' when 'Filmes e Séries' then 'película'
    when 'Stranger Things' then 'Stranger Things' when 'One Piece' then 'One Piece anime' when 'Harry Potter' then 'Harry Potter'
    when 'Futebol' then 'fútbol' when 'Dragon Ball' then 'Dragon Ball anime' when 'Militar' then 'militar'
    when 'Cidade' then 'ciudad' when 'Tempos Antigos' then 'histórico' when 'Piratas das Caraíbas' then 'Piratas del Caribe'
    when 'Os Simpsons' then 'Los Simpson' when 'Animação' then 'dibujos animados' when 'Medieval' then 'medieval'
    when 'Disney' then 'Disney' when 'Masters of the Universe' then 'He-Man Masters del Universo' when 'Faroeste' then 'Oeste'
    when 'Jogos' then 'videojuego' when 'Toy Story' then 'Toy Story Disney' when 'Animais' then 'animal'
    when 'NBA' then 'NBA baloncesto' when 'Rua Sésamo' then 'Barrio Sésamo' when 'Famosos' then 'famoso'
    when 'Tartarugas Ninja' then 'Tortugas Ninja' when 'Image Comics' then 'Image Comics' when 'Dinossauros' then 'Jurassic World'
    else '' end;
  t := array_to_string(partes, ' ');
  if kw <> '' and position(lower(kw) in lower(t)) = 0 then t := trim(t || ' ' || kw); end if;
  if p_tema = 'Animais' then pref := 'Figura'; elsif p_tema = 'Dinossauros' then pref := 'Figura Dinosaurio'; end if;
  return trim(regexp_replace(pref || ' ' || nome || case when t <> '' then ' - ' || t else '' end || ' muñeco' || extra, '\s+', ' ', 'g'));
end $$;
revoke execute on function public.tc_titulo_es(text,text) from public, anon, authenticated;
revoke execute on function public.tc_esc(text) from public, anon, authenticated;

-- Fila: lotes confirmados com título antigo -> título novo gerado
insert into todocoleccion_titulos_novos (lote_id, tema, base, titulo_atual)
select l.id, p.tema,
  trim(regexp_replace(regexp_replace(l.titulo, '\s*(Lego compatível minifiguras?|Minifigura Figura Minifigure.*Muñeco)\s*$', '', 'i'), '\s+', ' ', 'g')),
  l.titulo
from todocoleccion_lotes l join produtos p on p.id=l.produto_id
where l.emparelhamento='confirmado' and l.titulo not ilike 'Minifigura %'
on conflict do nothing;
update todocoleccion_titulos_novos set titulo_novo = tc_titulo_es(tema, base) where aplicado_em is null;

-- Envia 50 títulos de cada vez (só depois das descrições), no máximo 2 tentativas por lote
create or replace function public.todocoleccion_titulos_seguinte() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_itens jsonb; v_desc int;
begin
  select count(*) into v_desc from todocoleccion_lotes where emparelhamento='confirmado' and estado in (0,4) and descricao_versao is null;
  if v_desc > 0 then return jsonb_build_object('espera_descricoes', v_desc); end if;
  if exists (select 1 from todocoleccion_titulos_novos where aplicado_em > now() - interval '150 seconds') then
    return jsonb_build_object('em_curso', true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.lote_id, 'titulo', x.titulo_novo)), '[]') into v_itens from (
    select n.lote_id, n.titulo_novo from todocoleccion_titulos_novos n join todocoleccion_lotes l on l.id = n.lote_id
    where n.titulo_novo is not null and l.titulo is distinct from n.titulo_novo and n.tentativas < 2
    order by n.lote_id limit 50) x;
  if jsonb_array_length(v_itens) = 0 then return jsonb_build_object('terminado', true); end if;
  update todocoleccion_titulos_novos set tentativas = tentativas + 1, aplicado_em = now() where lote_id in (select (e->>'id')::bigint from jsonb_array_elements(v_itens) e);
  perform todocoleccion_disparar(jsonb_build_object('acao','titulos_lotes','itens', v_itens));
  return jsonb_build_object('enviados', jsonb_array_length(v_itens));
end $$;
revoke execute on function public.todocoleccion_titulos_seguinte() from public, anon, authenticated;
select cron.schedule('todocoleccion-titulos', '*/3 * * * *', $$select public.todocoleccion_titulos_seguinte()$$);

-- ===== 2026-10-27: marcar encomendas como enviadas no todocoleccion =====
alter table public.todocoleccion_encomendas add column if not exists enviada_tc_em timestamptz, add column if not exists envio_tc_erro text;

create or replace function public.todocoleccion_encomenda_enviada() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origem = 'Todocoleccion'
     and coalesce(new.referencia_externa, '') ~ '^[0-9]+$'
     and nullif(trim(coalesce(new.codigo_seguimento, '')), '') is not null
     and new.estado in ('Enviado', 'Concluído')
     and (old.estado is distinct from new.estado or old.codigo_seguimento is distinct from new.codigo_seguimento)
     and exists (select 1 from todocoleccion_encomendas e where e.id_order = new.referencia_externa::bigint and e.enviada_tc_em is null)
  then
    begin
      perform todocoleccion_disparar(jsonb_build_object('acao', 'marcar_enviada', 'id_order', new.referencia_externa::bigint,
        'codigo', trim(new.codigo_seguimento), 'data', to_char(now() at time zone 'Europe/Lisbon', 'DD/MM/YYYY')));
    exception when others then
      raise warning 'todocoleccion marcar_enviada: %', sqlerrm;
    end;
  end if;
  return new;
end $$;
revoke execute on function public.todocoleccion_encomenda_enviada() from public, anon, authenticated;

create trigger encomendas_tc_enviada after update of estado, codigo_seguimento on public.encomendas
for each row execute function public.todocoleccion_encomenda_enviada();
