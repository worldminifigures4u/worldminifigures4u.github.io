-- Executar no SQL Editor do Supabase.
-- Bloqueio de clientes do site: compras e/ou login.

alter table public.clientes_gestao
  add column if not exists bloquear_compras boolean not null default false,
  add column if not exists bloquear_conta boolean not null default false;

create or replace function public.aplicar_bloqueio_auth_cliente(
  p_auth_user_id uuid,
  p_bloquear_conta boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_auth_user_id is null then
    return;
  end if;

  update auth.users
  set banned_until = case
    when coalesce(p_bloquear_conta, false) then 'infinity'::timestamptz
    else null
  end
  where id = p_auth_user_id;
end;
$$;

create or replace function public.obter_restricoes_cliente_gestao(
  p_auth_user_id uuid,
  p_email text default null
)
returns table (
  cliente_id uuid,
  bloquear_compras boolean,
  bloquear_conta boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  if p_auth_user_id is not null then
    return query
    select cg.id, cg.bloquear_compras, cg.bloquear_conta
    from public.clientes_gestao cg
    where cg.auth_user_id = p_auth_user_id
    limit 1;

    if found then
      return;
    end if;
  end if;

  if v_email is not null then
    return query
    select cg.id, cg.bloquear_compras, cg.bloquear_conta
    from public.clientes_gestao cg
    where lower(coalesce(cg.email, '')) = lower(v_email)
    order by cg.updated_at desc nulls last, cg.created_at desc
    limit 1;
  end if;
end;
$$;

create or replace function public.guardar_restricoes_cliente_admin(
  p_cliente_id uuid,
  p_bloquear_compras boolean,
  p_bloquear_conta boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cliente public.clientes_gestao%rowtype;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_cliente
  from public.clientes_gestao
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  update public.clientes_gestao
  set bloquear_compras = coalesce(p_bloquear_compras, false),
      bloquear_conta = coalesce(p_bloquear_conta, false),
      updated_at = now()
  where id = p_cliente_id;

  perform public.aplicar_bloqueio_auth_cliente(v_cliente.auth_user_id, coalesce(p_bloquear_conta, false));

  return jsonb_build_object(
    'sucesso', true,
    'cliente_id', p_cliente_id,
    'bloquear_compras', coalesce(p_bloquear_compras, false),
    'bloquear_conta', coalesce(p_bloquear_conta, false)
  );
end;
$$;

create or replace function public.obter_restricoes_cliente_site()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_restricoes record;
begin
  if v_user_id is null then
    raise exception 'Nao autenticado';
  end if;

  select *
  into v_restricoes
  from public.obter_restricoes_cliente_gestao(v_user_id, v_email)
  limit 1;

  return jsonb_build_object(
    'bloquear_compras', coalesce(v_restricoes.bloquear_compras, false),
    'bloquear_conta', coalesce(v_restricoes.bloquear_conta, false),
    'cliente_id', v_restricoes.cliente_id
  );
end;
$$;

create or replace function public.assert_cliente_pode_comprar_site()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_restricoes record;
begin
  if v_user_id is null then
    raise exception 'Nao autenticado';
  end if;

  select *
  into v_restricoes
  from public.obter_restricoes_cliente_gestao(v_user_id, v_email)
  limit 1;

  if coalesce(v_restricoes.bloquear_conta, false) then
    raise exception 'Conta suspensa. Nao e possivel concluir compras.';
  end if;

  if coalesce(v_restricoes.bloquear_compras, false) then
    raise exception 'Compras bloqueadas para esta conta.';
  end if;
end;
$$;

revoke execute on function public.aplicar_bloqueio_auth_cliente(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.obter_restricoes_cliente_gestao(uuid, text) from public, anon, authenticated;
revoke execute on function public.guardar_restricoes_cliente_admin(uuid, boolean, boolean) from public, anon;
grant execute on function public.guardar_restricoes_cliente_admin(uuid, boolean, boolean) to authenticated;

revoke execute on function public.obter_restricoes_cliente_site() from public, anon;
grant execute on function public.obter_restricoes_cliente_site() to authenticated;

revoke execute on function public.assert_cliente_pode_comprar_site() from public, anon;
grant execute on function public.assert_cliente_pode_comprar_site() to authenticated;

-- Na Edge Function criar-encomenda, chamar antes de criar a encomenda:
-- await supabase.rpc('assert_cliente_pode_comprar_site');
