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
