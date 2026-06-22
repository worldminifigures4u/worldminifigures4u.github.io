-- Executar no SQL Editor do Supabase.
-- Cria fichas comerciais privadas e associa perfis externos as encomendas.

create table if not exists public.clientes_gestao (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nome text,
  email text,
  telefone text,
  morada text,
  cp text,
  cidade text,
  pais text,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clientes_gestao_email_unico
on public.clientes_gestao (lower(email))
where nullif(trim(email), '') is not null;

create table if not exists public.clientes_perfis_externos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes_gestao(id) on delete cascade,
  plataforma text not null check (plataforma in ('Wallapop', 'OLX', 'Todocoleccion')),
  utilizador text not null,
  utilizador_normalizado text not null,
  url_perfil text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plataforma, utilizador_normalizado)
);

alter table public.encomendas
  add column if not exists cliente_gestao_id uuid references public.clientes_gestao(id),
  add column if not exists perfil_externo_url text,
  add column if not exists perfil_externo_utilizador text;

alter table public.clientes_gestao enable row level security;
alter table public.clientes_perfis_externos enable row level security;
revoke all on public.clientes_gestao from public, anon, authenticated;
revoke all on public.clientes_perfis_externos from public, anon, authenticated;

create or replace function public.associar_perfil_encomenda_admin(
  p_encomenda_id text,
  p_url_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_cliente public.clientes_gestao%rowtype;
  v_plataforma text;
  v_utilizador text;
  v_url text := trim(coalesce(p_url_perfil, ''));
  v_perfis jsonb;
  v_historico jsonb;
  v_total numeric;
  v_quantidade integer;
  v_ultima timestamptz;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if v_url ~* '^https?://([^/]+\.)?wallapop\.com/user/[^/?#]+' then
    v_plataforma := 'Wallapop';
    v_utilizador := substring(v_url from '(?i)/user/([^/?#]+)');
  elsif v_url ~* '^https?://([^/]+\.)?olx\.pt/ads/user/[^/?#]+' then
    v_plataforma := 'OLX';
    v_utilizador := substring(v_url from '(?i)/ads/user/([^/?#]+)');
  elsif v_url ~* '^https?://([^/]+\.)?todocoleccion\.net/usuario/[^/?#]+' then
    v_plataforma := 'Todocoleccion';
    v_utilizador := substring(v_url from '(?i)/usuario/([^/?#]+)');
  else
    raise exception 'Link de perfil nao reconhecido';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id::text = p_encomenda_id
  for update;
  if not found then raise exception 'Encomenda nao encontrada'; end if;
  if lower(coalesce(v_encomenda.origem, '')) <> lower(v_plataforma) then
    raise exception 'O perfil nao pertence a plataforma da encomenda';
  end if;

  select cg.* into v_cliente
  from public.clientes_perfis_externos pe
  join public.clientes_gestao cg on cg.id = pe.cliente_id
  where pe.plataforma = v_plataforma
    and pe.utilizador_normalizado = lower(v_utilizador)
  limit 1;

  if not found and v_encomenda.cliente_gestao_id is not null then
    select * into v_cliente from public.clientes_gestao where id = v_encomenda.cliente_gestao_id;
  end if;
  if not found and v_encomenda.id_cliente is not null then
    select * into v_cliente from public.clientes_gestao where auth_user_id = v_encomenda.id_cliente limit 1;
  end if;
  if not found and nullif(trim(coalesce(v_encomenda.email_cliente, '')), '') is not null then
    select * into v_cliente from public.clientes_gestao
    where lower(email) = lower(trim(v_encomenda.email_cliente)) limit 1;
  end if;
  if not found then
    insert into public.clientes_gestao (
      auth_user_id, nome, email, telefone, morada, cp, cidade, pais
    ) values (
      v_encomenda.id_cliente, coalesce(nullif(trim(v_encomenda.nome_cliente), ''), v_utilizador),
      nullif(trim(v_encomenda.email_cliente), ''), nullif(trim(v_encomenda.telefone_cliente), ''),
      nullif(trim(v_encomenda.morada_cliente), ''), nullif(trim(v_encomenda.cp_cliente), ''),
      nullif(trim(v_encomenda.cidade_cliente), ''), nullif(trim(v_encomenda.pais_cliente), '')
    ) returning * into v_cliente;
  end if;

  update public.clientes_gestao set
    nome = coalesce(nullif(trim(v_encomenda.nome_cliente), ''), nome, v_utilizador),
    email = coalesce(nullif(trim(v_encomenda.email_cliente), ''), email),
    telefone = coalesce(nullif(trim(v_encomenda.telefone_cliente), ''), telefone),
    morada = coalesce(nullif(trim(v_encomenda.morada_cliente), ''), morada),
    cp = coalesce(nullif(trim(v_encomenda.cp_cliente), ''), cp),
    cidade = coalesce(nullif(trim(v_encomenda.cidade_cliente), ''), cidade),
    pais = coalesce(nullif(trim(v_encomenda.pais_cliente), ''), pais),
    updated_at = now()
  where id = v_cliente.id
  returning * into v_cliente;

  insert into public.clientes_perfis_externos (
    cliente_id, plataforma, utilizador, utilizador_normalizado, url_perfil
  ) values (
    v_cliente.id, v_plataforma, v_utilizador, lower(v_utilizador), v_url
  )
  on conflict (plataforma, utilizador_normalizado) do update set
    cliente_id = excluded.cliente_id,
    utilizador = excluded.utilizador,
    url_perfil = excluded.url_perfil,
    updated_at = now();

  update public.encomendas set
    cliente_gestao_id = v_cliente.id,
    perfil_externo_url = v_url,
    perfil_externo_utilizador = v_utilizador
  where id = v_encomenda.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'plataforma', plataforma, 'utilizador', utilizador, 'url', url_perfil
  ) order by plataforma), '[]'::jsonb)
  into v_perfis from public.clientes_perfis_externos where cliente_id = v_cliente.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'codigo', codigo_encomenda, 'data', created_at, 'origem', origem,
    'estado', estado, 'total', total
  ) order by created_at desc), '[]'::jsonb)
  into v_historico from public.encomendas where cliente_gestao_id = v_cliente.id;

  select count(*), coalesce(sum(total) filter (where estado <> 'Cancelado'), 0), max(created_at)
  into v_quantidade, v_total, v_ultima
  from public.encomendas where cliente_gestao_id = v_cliente.id;

  return jsonb_build_object(
    'sucesso', true,
    'cliente_id', v_cliente.id,
    'cliente', to_jsonb(v_cliente),
    'perfis', v_perfis,
    'historico', v_historico,
    'resumo', jsonb_build_object('encomendas', v_quantidade, 'total', v_total, 'ultima_compra', v_ultima),
    'numero_encomenda_cliente', v_quantidade,
    'plataforma', v_plataforma,
    'utilizador', v_utilizador,
    'url', v_url
  );
end;
$$;

revoke execute on function public.associar_perfil_encomenda_admin(text, text) from public, anon;
grant execute on function public.associar_perfil_encomenda_admin(text, text) to authenticated;

create or replace function public.obter_ficha_cliente_admin(p_encomenda_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_cliente public.clientes_gestao%rowtype;
  v_perfis jsonb;
  v_historico jsonb;
  v_total numeric;
  v_quantidade integer;
  v_ultima timestamptz;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_encomenda from public.encomendas where id::text = p_encomenda_id;
  if not found then raise exception 'Encomenda nao encontrada'; end if;

  if v_encomenda.cliente_gestao_id is not null then
    select * into v_cliente from public.clientes_gestao where id = v_encomenda.cliente_gestao_id;
  end if;
  if not found and v_encomenda.id_cliente is not null then
    select * into v_cliente from public.clientes_gestao where auth_user_id = v_encomenda.id_cliente limit 1;
  end if;
  if not found and nullif(trim(coalesce(v_encomenda.email_cliente, '')), '') is not null then
    select * into v_cliente from public.clientes_gestao
    where lower(email) = lower(trim(v_encomenda.email_cliente)) limit 1;
  end if;
  if not found then
    insert into public.clientes_gestao (
      auth_user_id, nome, email, telefone, morada, cp, cidade, pais
    ) values (
      v_encomenda.id_cliente, v_encomenda.nome_cliente, nullif(trim(v_encomenda.email_cliente), ''),
      nullif(trim(v_encomenda.telefone_cliente), ''), nullif(trim(v_encomenda.morada_cliente), ''),
      nullif(trim(v_encomenda.cp_cliente), ''), nullif(trim(v_encomenda.cidade_cliente), ''),
      nullif(trim(v_encomenda.pais_cliente), '')
    ) returning * into v_cliente;
  end if;

  update public.clientes_gestao set
    auth_user_id = coalesce(auth_user_id, v_encomenda.id_cliente)
  where id = v_cliente.id returning * into v_cliente;

  update public.encomendas set cliente_gestao_id = v_cliente.id
  where cliente_gestao_id is null and (
    id = v_encomenda.id
    or (v_cliente.auth_user_id is not null and id_cliente = v_cliente.auth_user_id)
    or (nullif(trim(coalesce(v_cliente.email, '')), '') is not null
        and lower(email_cliente) = lower(v_cliente.email))
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'plataforma', plataforma, 'utilizador', utilizador, 'url', url_perfil
  ) order by plataforma), '[]'::jsonb)
  into v_perfis from public.clientes_perfis_externos where cliente_id = v_cliente.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'codigo', codigo_encomenda, 'data', created_at, 'origem', origem,
    'estado', estado, 'total', total
  ) order by created_at desc), '[]'::jsonb)
  into v_historico from public.encomendas where cliente_gestao_id = v_cliente.id;

  select count(*), coalesce(sum(total) filter (where estado <> 'Cancelado'), 0), max(created_at)
  into v_quantidade, v_total, v_ultima
  from public.encomendas where cliente_gestao_id = v_cliente.id;

  return jsonb_build_object(
    'sucesso', true,
    'cliente', to_jsonb(v_cliente),
    'perfis', v_perfis,
    'historico', v_historico,
    'resumo', jsonb_build_object('encomendas', v_quantidade, 'total', v_total, 'ultima_compra', v_ultima)
  );
end;
$$;

revoke execute on function public.obter_ficha_cliente_admin(text) from public, anon;
grant execute on function public.obter_ficha_cliente_admin(text) to authenticated;

create or replace function public.guardar_notas_cliente_admin(p_cliente_id uuid, p_notas text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;
  update public.clientes_gestao
  set notas = left(coalesce(p_notas, ''), 5000), updated_at = now()
  where id = p_cliente_id;
  if not found then raise exception 'Cliente nao encontrado'; end if;
  return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.guardar_notas_cliente_admin(uuid, text) from public, anon;
grant execute on function public.guardar_notas_cliente_admin(uuid, text) to authenticated;

create or replace function public.atualizar_cliente_externo_admin(
  p_cliente_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_morada text,
  p_cp text,
  p_cidade text,
  p_pais text
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

  if v_cliente.auth_user_id is not null then
    raise exception 'Os dados de clientes registados no site sao geridos pelo proprio cliente';
  end if;

  if nullif(trim(coalesce(p_nome, '')), '') is null then
    raise exception 'O nome do cliente e obrigatorio';
  end if;

  if v_email is not null and exists (
    select 1
    from public.clientes_gestao
    where id <> p_cliente_id and lower(email) = lower(v_email)
  ) then
    raise exception 'Ja existe outro cliente com este e-mail';
  end if;

  update public.clientes_gestao
  set nome = trim(p_nome),
      email = v_email,
      telefone = nullif(trim(coalesce(p_telefone, '')), ''),
      morada = nullif(trim(coalesce(p_morada, '')), ''),
      cp = nullif(trim(coalesce(p_cp, '')), ''),
      cidade = nullif(trim(coalesce(p_cidade, '')), ''),
      pais = nullif(trim(coalesce(p_pais, '')), ''),
      updated_at = now()
  where id = p_cliente_id
  returning * into v_cliente;

  return jsonb_build_object('sucesso', true, 'cliente', to_jsonb(v_cliente));
end;
$$;

revoke execute on function public.atualizar_cliente_externo_admin(
  uuid, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.atualizar_cliente_externo_admin(
  uuid, text, text, text, text, text, text, text
) to authenticated;
