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
