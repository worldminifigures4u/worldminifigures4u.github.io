-- Executar no SQL Editor do Supabase.
-- Permite ao admin corrigir dados de clientes registados no site.

drop function if exists public.atualizar_cliente_externo_admin(
  uuid, text, text, text, text, text, text, text
);

create or replace function public.atualizar_cliente_externo_admin(
  p_cliente_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_morada text,
  p_cp text,
  p_cidade text,
  p_pais text,
  p_nome_utilizador text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes_gestao%rowtype;
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_cliente
  from public.clientes_gestao
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  if nullif(trim(coalesce(p_nome_utilizador, p_nome, '')), '') is null then
    raise exception 'O nome de utilizador do cliente e obrigatorio';
  end if;

  if v_email is not null and exists (
    select 1
    from public.clientes_gestao
    where id <> p_cliente_id and lower(email) = lower(v_email)
  ) then
    raise exception 'Ja existe outro cliente com este e-mail';
  end if;

  update public.clientes_gestao
  set nome_utilizador = trim(coalesce(p_nome_utilizador, p_nome)),
      nome = nullif(trim(coalesce(p_nome, '')), ''),
      email = v_email,
      telefone = nullif(trim(coalesce(p_telefone, '')), ''),
      morada = nullif(trim(coalesce(p_morada, '')), ''),
      cp = nullif(trim(coalesce(p_cp, '')), ''),
      cidade = nullif(trim(coalesce(p_cidade, '')), ''),
      pais = nullif(trim(coalesce(p_pais, '')), ''),
      updated_at = now()
  where id = p_cliente_id
  returning * into v_cliente;

  if v_cliente.auth_user_id is not null and to_regclass('public.clientes') is not null then
    insert into public.clientes (
      id, nome, email, telemovel, morada, cp, cidade, pais
    ) values (
      v_cliente.auth_user_id,
      nullif(trim(coalesce(p_nome, '')), ''),
      v_email,
      nullif(trim(coalesce(p_telefone, '')), ''),
      nullif(trim(coalesce(p_morada, '')), ''),
      nullif(trim(coalesce(p_cp, '')), ''),
      nullif(trim(coalesce(p_cidade, '')), ''),
      nullif(trim(coalesce(p_pais, '')), '')
    )
    on conflict (id) do update set
      nome = excluded.nome,
      email = excluded.email,
      telemovel = excluded.telemovel,
      morada = excluded.morada,
      cp = excluded.cp,
      cidade = excluded.cidade,
      pais = excluded.pais;
  end if;

  return jsonb_build_object('sucesso', true, 'cliente', to_jsonb(v_cliente));
end;
$$;

revoke execute on function public.atualizar_cliente_externo_admin(
  uuid, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.atualizar_cliente_externo_admin(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;
