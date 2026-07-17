-- Executar no SQL Editor do Supabase.
-- Cria ficha em clientes_gestao quando um cliente se regista no site
-- e mantém sincronização quando o perfil é atualizado na Conta.
-- Contas de administrador (ADMIN) não criam nem recriam ficha de cliente.

create or replace function public.email_e_admin_clientes(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) = 'worldminifigures4u@gmail.com';
$$;

create or replace function public.upsert_ficha_cliente_gestao_por_conta(
  p_auth_user_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_morada text,
  p_cp text,
  p_cidade text,
  p_pais text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes_gestao%rowtype;
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  if p_auth_user_id is null then
    raise exception 'Utilizador invalido';
  end if;

  -- Conta admin nao deve aparecer na lista de clientes.
  if public.email_e_admin_clientes(v_email) then
    return null;
  end if;

  select * into v_cliente
  from public.clientes_gestao
  where auth_user_id = p_auth_user_id
  limit 1;

  if not found and v_email is not null then
    select * into v_cliente
    from public.clientes_gestao
    where lower(email) = lower(v_email)
    limit 1;
  end if;

  if found then
    update public.clientes_gestao
    set auth_user_id = coalesce(public.clientes_gestao.auth_user_id, p_auth_user_id),
        nome = nullif(trim(coalesce(p_nome, '')), ''),
        email = v_email,
        telefone = nullif(trim(coalesce(p_telefone, '')), ''),
        morada = nullif(trim(coalesce(p_morada, '')), ''),
        cp = nullif(trim(coalesce(p_cp, '')), ''),
        cidade = nullif(trim(coalesce(p_cidade, '')), ''),
        pais = nullif(trim(coalesce(p_pais, '')), ''),
        updated_at = now()
    where id = v_cliente.id
    returning id into v_cliente.id;
  else
    insert into public.clientes_gestao (
      auth_user_id, nome, email, telefone, morada, cp, cidade, pais
    ) values (
      p_auth_user_id,
      nullif(trim(coalesce(p_nome, '')), ''),
      v_email,
      nullif(trim(coalesce(p_telefone, '')), ''),
      nullif(trim(coalesce(p_morada, '')), ''),
      nullif(trim(coalesce(p_cp, '')), ''),
      nullif(trim(coalesce(p_cidade, '')), ''),
      nullif(trim(coalesce(p_pais, '')), '')
    )
    returning id into v_cliente.id;
  end if;

  return v_cliente.id;
end;
$$;

create or replace function public.criar_ficha_cliente_registo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.email_e_admin_clientes(new.email) then
    return new;
  end if;

  perform public.upsert_ficha_cliente_gestao_por_conta(
    new.id,
    new.raw_user_meta_data ->> 'nome',
    new.email,
    new.raw_user_meta_data ->> 'telemovel',
    new.raw_user_meta_data ->> 'morada',
    new.raw_user_meta_data ->> 'cp',
    new.raw_user_meta_data ->> 'cidade',
    new.raw_user_meta_data ->> 'pais'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_clientes_gestao on auth.users;

create trigger on_auth_user_created_clientes_gestao
  after insert on auth.users
  for each row
  execute function public.criar_ficha_cliente_registo();

create or replace function public.sincronizar_ficha_cliente_site()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_perfil public.clientes%rowtype;
  v_auth_user auth.users%rowtype;
  v_cliente_id uuid;
  v_email text;
  v_tem_perfil boolean := false;
begin
  if v_user_id is null then
    raise exception 'Nao autenticado';
  end if;

  select * into v_perfil
  from public.clientes
  where id = v_user_id;

  if found then
    v_tem_perfil := true;
    v_email := v_perfil.email;
  else
    select * into v_auth_user
    from auth.users
    where id = v_user_id;

    if not found then
      raise exception 'Utilizador nao encontrado';
    end if;

    v_email := v_auth_user.email;
  end if;

  if public.email_e_admin_clientes(v_email) then
    return jsonb_build_object(
      'sucesso', true,
      'ignorado', true,
      'motivo', 'conta_admin'
    );
  end if;

  if v_tem_perfil then
    v_cliente_id := public.upsert_ficha_cliente_gestao_por_conta(
      v_user_id,
      v_perfil.nome,
      v_perfil.email,
      v_perfil.telemovel,
      v_perfil.morada,
      v_perfil.cp,
      v_perfil.cidade,
      v_perfil.pais
    );
  else
    v_cliente_id := public.upsert_ficha_cliente_gestao_por_conta(
      v_user_id,
      v_auth_user.raw_user_meta_data ->> 'nome',
      v_auth_user.email,
      v_auth_user.raw_user_meta_data ->> 'telemovel',
      v_auth_user.raw_user_meta_data ->> 'morada',
      v_auth_user.raw_user_meta_data ->> 'cp',
      v_auth_user.raw_user_meta_data ->> 'cidade',
      v_auth_user.raw_user_meta_data ->> 'pais'
    );
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'cliente_id', v_cliente_id
  );
end;
$$;

-- Remove fichas ja existentes do email de administrador.
delete from public.clientes_perfis_externos
where cliente_id in (
  select id from public.clientes_gestao
  where lower(trim(coalesce(email, ''))) = 'worldminifigures4u@gmail.com'
);

update public.encomendas
set cliente_gestao_id = null
where cliente_gestao_id in (
  select id from public.clientes_gestao
  where lower(trim(coalesce(email, ''))) = 'worldminifigures4u@gmail.com'
);

delete from public.clientes_gestao
where lower(trim(coalesce(email, ''))) = 'worldminifigures4u@gmail.com';

revoke execute on function public.email_e_admin_clientes(text) from public, anon, authenticated;
revoke execute on function public.upsert_ficha_cliente_gestao_por_conta(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.criar_ficha_cliente_registo() from public, anon, authenticated;

revoke execute on function public.sincronizar_ficha_cliente_site() from public, anon;
grant execute on function public.sincronizar_ficha_cliente_site() to authenticated;
