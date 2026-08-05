-- Executar no SQL Editor do Supabase (uma vez).
-- Hardening de seguranca:
-- 1) Funcao central is_admin() (email JWT normalizado)
-- 2) Reescreve funcoes/policies que comparavam o email admin sem lower()
-- 3) Revoga escrita directa em banners_loja (so RPCs admin)
-- 4) Revoga SELECT directo em produtos (catalogo so via produtos_loja)
--
-- Headers HTTP (HSTS, X-Content-Type-Options, etc.): GitHub Pages nao os
-- permite; configurar no Cloudflare (ou proxy) a frente de figuresplanet.com.

create or replace function public.email_e_admin_clientes(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) = 'worldminifigures4u@gmail.com';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.email_e_admin_clientes(auth.jwt() ->> 'email');
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
-- Policies RLS avaliam is_admin() no contexto do pedido; anon precisa
-- de execute para USING em leituras publicas com bypass admin (ex. portes).
grant execute on function public.is_admin() to anon;

-- ---------------------------------------------------------------------------
-- Reescreve corpos de funcoes publicas que ainda comparam o email em cru.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  src text;
  novo text;
  alterados integer := 0;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%worldminifigures4u@gmail.com%'
      and pg_get_functiondef(p.oid) like '%auth.jwt()%'
  loop
    src := pg_get_functiondef(r.oid);
    novo := src;

    -- Variantes multi-linha / com lower / sem lower
    novo := regexp_replace(
      novo,
      'lower\s*\(\s*coalesce\s*\(\s*auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*,\s*''''\s*\)\s*\)\s*<>\s*[\s\n]*''worldminifigures4u@gmail\.com''',
      'not public.is_admin()',
      'gi'
    );
    novo := regexp_replace(
      novo,
      'lower\s*\(\s*coalesce\s*\(\s*auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*,\s*''''\s*\)\s*\)\s*=\s*[\s\n]*''worldminifigures4u@gmail\.com''',
      'public.is_admin()',
      'gi'
    );
    novo := regexp_replace(
      novo,
      'coalesce\s*\(\s*auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*,\s*''''\s*\)\s*<>\s*[\s\n]*''worldminifigures4u@gmail\.com''',
      'not public.is_admin()',
      'gi'
    );
    novo := regexp_replace(
      novo,
      'coalesce\s*\(\s*auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*,\s*''''\s*\)\s*=\s*[\s\n]*''worldminifigures4u@gmail\.com''',
      'public.is_admin()',
      'gi'
    );
    novo := regexp_replace(
      novo,
      '\(\s*select\s+auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*\)\s*=\s*''worldminifigures4u@gmail\.com''',
      'public.is_admin()',
      'gi'
    );
    novo := regexp_replace(
      novo,
      'auth\.jwt\s*\(\s*\)\s*->>\s*''email''\s*=\s*''worldminifigures4u@gmail\.com''',
      'public.is_admin()',
      'gi'
    );

    if novo is distinct from src then
      execute novo;
      alterados := alterados + 1;
    end if;
  end loop;

  raise notice 'Funcoes admin reescritas com is_admin(): %', alterados;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policies RLS conhecidas (recria com is_admin) — so se a tabela existir.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.encomendas') is not null then
    drop policy if exists "Administrador pode ler todas as encomendas" on public.encomendas;
    create policy "Administrador pode ler todas as encomendas"
    on public.encomendas for select to authenticated
    using (public.is_admin());

    drop policy if exists "Administrador pode atualizar estado das encomendas" on public.encomendas;
    create policy "Administrador pode atualizar estado das encomendas"
    on public.encomendas for update to authenticated
    using (public.is_admin()) with check (public.is_admin());
  end if;

  if to_regclass('public.encomendas_fornecedores') is not null then
    drop policy if exists "Admin pode ler encomendas fornecedores" on public.encomendas_fornecedores;
    create policy "Admin pode ler encomendas fornecedores"
    on public.encomendas_fornecedores for select to authenticated
    using (public.is_admin());

    drop policy if exists "Admin pode criar encomendas fornecedores" on public.encomendas_fornecedores;
    create policy "Admin pode criar encomendas fornecedores"
    on public.encomendas_fornecedores for insert to authenticated
    with check (public.is_admin());

    drop policy if exists "Admin pode atualizar encomendas fornecedores" on public.encomendas_fornecedores;
    create policy "Admin pode atualizar encomendas fornecedores"
    on public.encomendas_fornecedores for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

    drop policy if exists "Admin pode apagar encomendas fornecedores" on public.encomendas_fornecedores;
    create policy "Admin pode apagar encomendas fornecedores"
    on public.encomendas_fornecedores for delete to authenticated
    using (public.is_admin());
  end if;

  if to_regclass('public.fornecedores_admin') is not null then
    drop policy if exists "Admin pode ler fornecedores" on public.fornecedores_admin;
    create policy "Admin pode ler fornecedores"
    on public.fornecedores_admin for select to authenticated
    using (public.is_admin());

    drop policy if exists "Admin pode criar fornecedores" on public.fornecedores_admin;
    create policy "Admin pode criar fornecedores"
    on public.fornecedores_admin for insert to authenticated
    with check (public.is_admin());

    drop policy if exists "Admin pode atualizar fornecedores" on public.fornecedores_admin;
    create policy "Admin pode atualizar fornecedores"
    on public.fornecedores_admin for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

    drop policy if exists "Admin pode apagar fornecedores" on public.fornecedores_admin;
    create policy "Admin pode apagar fornecedores"
    on public.fornecedores_admin for delete to authenticated
    using (public.is_admin());
  end if;

  if to_regclass('public.portes_tarifas') is not null then
    drop policy if exists "Leitura publica portes ativos" on public.portes_tarifas;
    create policy "Leitura publica portes ativos"
    on public.portes_tarifas for select to anon, authenticated
    using (ativo = true or public.is_admin());
  end if;

  if to_regclass('public.portes_metodos') is not null then
    drop policy if exists "Leitura portes metodos" on public.portes_metodos;
    create policy "Leitura portes metodos"
    on public.portes_metodos for select to anon, authenticated
    using (ativo = true or public.is_admin());
  end if;

  if to_regclass('storage.objects') is not null then
    drop policy if exists "Admin pode consultar anexos de encomendas" on storage.objects;
    create policy "Admin pode consultar anexos de encomendas"
    on storage.objects for select to authenticated
    using (bucket_id = 'anexos-encomendas' and public.is_admin());

    drop policy if exists "Admin pode adicionar anexos de encomendas" on storage.objects;
    create policy "Admin pode adicionar anexos de encomendas"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'anexos-encomendas' and public.is_admin());

    drop policy if exists "Admin pode apagar anexos de encomendas" on storage.objects;
    create policy "Admin pode apagar anexos de encomendas"
    on storage.objects for delete to authenticated
    using (bucket_id = 'anexos-encomendas' and public.is_admin());
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Banners: so SELECT publico; escrita exclusivamente via RPC admin.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.banners_loja') is not null then
    revoke insert, update, delete on table public.banners_loja from public, anon, authenticated;
    grant select on table public.banners_loja to anon, authenticated;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Produtos: catalogo so pela vista publica (sem stock/custo/referencia).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.produtos') is null then
    raise notice 'Tabela public.produtos inexistente — skip.';
    return;
  end if;

  revoke all on table public.produtos from public, anon, authenticated;

  execute $view$
    create or replace view public.produtos_loja
    with (security_invoker = false)
    as
    select
      produto.id,
      produto.sku,
      produto.nome,
      produto.preco,
      produto.peso,
      produto.tema,
      produto.subtema,
      produto.imagens,
      produto.ativo,
      coalesce(produto.descontinuado, false) as descontinuado,
      coalesce(produto.arquivado, false) as arquivado
    from public.produtos as produto
  $view$;

  grant select on public.produtos_loja to anon, authenticated;
end;
$$;

-- Confirmacao rapida (aparecem no output do SQL Editor)
select
  has_table_privilege('anon', 'public.produtos', 'select') as anon_select_produtos,
  has_table_privilege('anon', 'public.produtos_loja', 'select') as anon_select_produtos_loja,
  has_table_privilege('anon', 'public.banners_loja', 'update') as anon_update_banners,
  public.email_e_admin_clientes('WorldMinifigures4U@gmail.com') as admin_email_normalizado;
