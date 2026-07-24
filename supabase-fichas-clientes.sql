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
  tem_aviso boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clientes_gestao
  add column if not exists auth_user_id uuid,
  add column if not exists nome text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists morada text,
  add column if not exists cp text,
  add column if not exists cidade text,
  add column if not exists pais text,
  add column if not exists notas text not null default '',
  add column if not exists tem_aviso boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists clientes_gestao_auth_user_id_unico
on public.clientes_gestao (auth_user_id)
where auth_user_id is not null;

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

alter table public.clientes_perfis_externos
  add column if not exists cliente_id uuid references public.clientes_gestao(id) on delete cascade,
  add column if not exists plataforma text,
  add column if not exists utilizador text,
  add column if not exists utilizador_normalizado text,
  add column if not exists url_perfil text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists clientes_perfis_externos_plataforma_utilizador_unico
on public.clientes_perfis_externos (plataforma, utilizador_normalizado);

alter table public.encomendas
  add column if not exists cliente_gestao_id uuid references public.clientes_gestao(id),
  add column if not exists perfil_externo_url text,
  add column if not exists perfil_externo_utilizador text,
  add column if not exists telefone_cliente text,
  add column if not exists morada_cliente text,
  add column if not exists cp_cliente text,
  add column if not exists cidade_cliente text,
  add column if not exists pais_cliente text;

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
  elsif v_url ~* '^https?://([^/]*\.)?vinted\.[a-z.]+/member/[^/?#]+' then
    v_plataforma := 'Vinted';
    v_utilizador := substring(v_url from '(?i)/member/([^/?#]+)');
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

create or replace function public.guardar_aviso_cliente_admin(p_cliente_id uuid, p_tem_aviso boolean)
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
  set tem_aviso = coalesce(p_tem_aviso, false), updated_at = now()
  where id = p_cliente_id;
  if not found then raise exception 'Cliente nao encontrado'; end if;
  return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.guardar_aviso_cliente_admin(uuid, boolean) from public, anon;
grant execute on function public.guardar_aviso_cliente_admin(uuid, boolean) to authenticated;

create or replace function public.criar_cliente_externo_admin(
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

  if nullif(trim(coalesce(p_nome, '')), '') is null then
    raise exception 'O nome do cliente e obrigatorio';
  end if;

  if v_email is not null and exists (
    select 1
    from public.clientes_gestao
    where lower(email) = lower(v_email)
  ) then
    raise exception 'Ja existe outro cliente com este e-mail';
  end if;

  insert into public.clientes_gestao (
    nome, email, telefone, morada, cp, cidade, pais
  ) values (
    trim(p_nome),
    v_email,
    nullif(trim(coalesce(p_telefone, '')), ''),
    nullif(trim(coalesce(p_morada, '')), ''),
    nullif(trim(coalesce(p_cp, '')), ''),
    nullif(trim(coalesce(p_cidade, '')), ''),
    nullif(trim(coalesce(p_pais, '')), '')
  )
  returning * into v_cliente;

  return jsonb_build_object('sucesso', true, 'cliente', to_jsonb(v_cliente));
end;
$$;

revoke execute on function public.criar_cliente_externo_admin(
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.criar_cliente_externo_admin(
  text, text, text, text, text, text, text
) to authenticated;

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

create or replace function public.normalizar_url_perfil_externo_admin(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := trim(coalesce(p_url, ''));
  v_plataforma text;
  v_utilizador text;
begin
  if v_url = '' then
    return null;
  end if;

  if v_url ~* '^https?://([^/]+\.)?wallapop\.com/user/[^/?#]+' then
    v_plataforma := 'Wallapop';
    v_utilizador := substring(v_url from '(?i)/user/([^/?#]+)');
  elsif v_url ~* '^https?://([^/]*\.)?vinted\.[a-z.]+/member/[^/?#]+' then
    v_plataforma := 'Vinted';
    v_utilizador := substring(v_url from '(?i)/member/([^/?#]+)');
  elsif v_url ~* '^https?://([^/]+\.)?olx\.pt/ads/user/[^/?#]+' then
    v_plataforma := 'OLX';
    v_utilizador := substring(v_url from '(?i)/ads/user/([^/?#]+)');
  elsif v_url ~* '^https?://([^/]+\.)?todocoleccion\.net/usuario/[^/?#]+' then
    v_plataforma := 'Todocoleccion';
    v_utilizador := substring(v_url from '(?i)/usuario/([^/?#]+)');
  else
    raise exception 'Link de perfil nao reconhecido: %', v_url;
  end if;

  return jsonb_build_object(
    'plataforma', v_plataforma,
    'utilizador', v_utilizador,
    'utilizador_normalizado', lower(v_utilizador),
    'url', v_url
  );
end;
$$;

revoke execute on function public.normalizar_url_perfil_externo_admin(text) from public, anon;
grant execute on function public.normalizar_url_perfil_externo_admin(text) to authenticated;

create or replace function public.guardar_perfis_cliente_admin(
  p_cliente_id uuid,
  p_perfis jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil jsonb;
  v_normalizado jsonb;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if not exists (select 1 from public.clientes_gestao where id = p_cliente_id) then
    raise exception 'Cliente nao encontrado';
  end if;

  if jsonb_typeof(coalesce(p_perfis, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de perfis invalida';
  end if;
  if jsonb_array_length(coalesce(p_perfis, '[]'::jsonb)) > 5 then
    raise exception 'A ficha permite no maximo 5 links externos';
  end if;

  delete from public.clientes_perfis_externos
  where cliente_id = p_cliente_id;

  for v_perfil in select value from jsonb_array_elements(coalesce(p_perfis, '[]'::jsonb))
  loop
    if nullif(trim(coalesce(v_perfil->>'url', v_perfil#>>'{}')), '') is null then
      continue;
    end if;
    v_normalizado := public.normalizar_url_perfil_externo_admin(coalesce(v_perfil->>'url', v_perfil#>>'{}'));
    insert into public.clientes_perfis_externos (
      cliente_id, plataforma, utilizador, utilizador_normalizado, url_perfil
    ) values (
      p_cliente_id,
      v_normalizado->>'plataforma',
      v_normalizado->>'utilizador',
      v_normalizado->>'utilizador_normalizado',
      v_normalizado->>'url'
    )
    on conflict (plataforma, utilizador_normalizado) do update set
      cliente_id = excluded.cliente_id,
      utilizador = excluded.utilizador,
      url_perfil = excluded.url_perfil,
      updated_at = now();
  end loop;

  return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.guardar_perfis_cliente_admin(uuid, jsonb) from public, anon;
grant execute on function public.guardar_perfis_cliente_admin(uuid, jsonb) to authenticated;

create or replace function public.vincular_encomendas_cliente_gestao(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.encomendas e
  set cliente_gestao_id = cg.id
  from public.clientes_gestao cg
  where cg.id = p_cliente_id
    and e.cliente_gestao_id is null
    and (
      (cg.auth_user_id is not null and e.id_cliente = cg.auth_user_id)
      or (
        nullif(trim(coalesce(cg.email, '')), '') is not null
        and lower(trim(coalesce(e.email_cliente, ''))) = lower(trim(cg.email))
      )
    );
end;
$$;

revoke execute on function public.vincular_encomendas_cliente_gestao(uuid) from public, anon, authenticated;
grant execute on function public.vincular_encomendas_cliente_gestao(uuid) to authenticated;

create or replace function public.obter_ficha_cliente_por_perfil_admin(p_url_perfil text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalizado jsonb;
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

  v_normalizado := public.normalizar_url_perfil_externo_admin(p_url_perfil);

  select cg.* into v_cliente
  from public.clientes_perfis_externos pe
  join public.clientes_gestao cg on cg.id = pe.cliente_id
  where pe.plataforma = v_normalizado->>'plataforma'
    and pe.utilizador_normalizado = v_normalizado->>'utilizador_normalizado'
  limit 1;

  if not found then
    return jsonb_build_object(
      'sucesso', false,
      'erro', 'Ficha de cliente nao encontrada para este perfil',
      'perfil', v_normalizado
    );
  end if;

  perform public.vincular_encomendas_cliente_gestao(v_cliente.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'plataforma', plataforma, 'utilizador', utilizador, 'url', url_perfil
  ) order by plataforma, utilizador), '[]'::jsonb)
  into v_perfis from public.clientes_perfis_externos where cliente_id = v_cliente.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'codigo', e.codigo_encomenda, 'data', e.created_at, 'origem', e.origem,
    'estado', e.estado, 'total', e.total
  ) order by e.created_at desc), '[]'::jsonb)
  into v_historico
  from public.encomendas e
  where e.cliente_gestao_id = v_cliente.id
     or (v_cliente.auth_user_id is not null and e.id_cliente = v_cliente.auth_user_id)
     or (
       nullif(trim(coalesce(v_cliente.email, '')), '') is not null
       and lower(trim(coalesce(e.email_cliente, ''))) = lower(trim(v_cliente.email))
     );

  select count(*), coalesce(sum(e.total) filter (where e.estado <> 'Cancelado'), 0), max(e.created_at)
  into v_quantidade, v_total, v_ultima
  from public.encomendas e
  where e.cliente_gestao_id = v_cliente.id
     or (v_cliente.auth_user_id is not null and e.id_cliente = v_cliente.auth_user_id)
     or (
       nullif(trim(coalesce(v_cliente.email, '')), '') is not null
       and lower(trim(coalesce(e.email_cliente, ''))) = lower(trim(v_cliente.email))
     );

  return jsonb_build_object(
    'sucesso', true,
    'cliente', to_jsonb(v_cliente),
    'perfis', v_perfis,
    'historico', v_historico,
    'resumo', jsonb_build_object('encomendas', v_quantidade, 'total', v_total, 'ultima_compra', v_ultima)
  );
end;
$$;

revoke execute on function public.obter_ficha_cliente_por_perfil_admin(text) from public, anon;
grant execute on function public.obter_ficha_cliente_por_perfil_admin(text) to authenticated;

create or replace function public.obter_ficha_cliente_por_id_admin(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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

  select * into v_cliente from public.clientes_gestao where id = p_cliente_id;
  if not found then raise exception 'Cliente nao encontrado'; end if;

  perform public.vincular_encomendas_cliente_gestao(v_cliente.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'plataforma', plataforma, 'utilizador', utilizador, 'url', url_perfil
  ) order by plataforma, utilizador), '[]'::jsonb)
  into v_perfis from public.clientes_perfis_externos where cliente_id = v_cliente.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'codigo', e.codigo_encomenda, 'data', e.created_at, 'origem', e.origem,
    'estado', e.estado, 'total', e.total
  ) order by e.created_at desc), '[]'::jsonb)
  into v_historico
  from public.encomendas e
  where e.cliente_gestao_id = v_cliente.id
     or (v_cliente.auth_user_id is not null and e.id_cliente = v_cliente.auth_user_id)
     or (
       nullif(trim(coalesce(v_cliente.email, '')), '') is not null
       and lower(trim(coalesce(e.email_cliente, ''))) = lower(trim(v_cliente.email))
     );

  select count(*), coalesce(sum(e.total) filter (where e.estado <> 'Cancelado'), 0), max(e.created_at)
  into v_quantidade, v_total, v_ultima
  from public.encomendas e
  where e.cliente_gestao_id = v_cliente.id
     or (v_cliente.auth_user_id is not null and e.id_cliente = v_cliente.auth_user_id)
     or (
       nullif(trim(coalesce(v_cliente.email, '')), '') is not null
       and lower(trim(coalesce(e.email_cliente, ''))) = lower(trim(v_cliente.email))
     );

  return jsonb_build_object(
    'sucesso', true,
    'cliente', to_jsonb(v_cliente),
    'perfis', v_perfis,
    'historico', v_historico,
    'resumo', jsonb_build_object('encomendas', v_quantidade, 'total', v_total, 'ultima_compra', v_ultima)
  );
end;
$$;

revoke execute on function public.obter_ficha_cliente_por_id_admin(uuid) from public, anon;
grant execute on function public.obter_ficha_cliente_por_id_admin(uuid) to authenticated;

create or replace function public.apagar_cliente_admin(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes_gestao%rowtype;
  v_encomendas integer;
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

  update public.encomendas
  set cliente_gestao_id = null
  where cliente_gestao_id = p_cliente_id;
  get diagnostics v_encomendas = row_count;

  delete from public.clientes_perfis_externos
  where cliente_id = p_cliente_id;

  delete from public.clientes_gestao
  where id = p_cliente_id;

  return jsonb_build_object(
    'sucesso', true,
    'cliente_id', p_cliente_id,
    'encomendas_desassociadas', v_encomendas
  );
end;
$$;

revoke execute on function public.apagar_cliente_admin(uuid) from public, anon;
grant execute on function public.apagar_cliente_admin(uuid) to authenticated;

create or replace function public.listar_clientes_admin(p_pesquisa text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pesquisa text := lower(trim(coalesce(p_pesquisa, '')));
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'cliente', to_jsonb(cliente),
      'perfis', coalesce(perfis.perfis, '[]'::jsonb),
      'resumo', jsonb_build_object(
        'encomendas', coalesce(resumo.encomendas, 0),
        'total', coalesce(resumo.total, 0),
        'ultima_compra', resumo.ultima_compra
      )
    ) order by coalesce(resumo.ultima_compra, cliente.updated_at, cliente.created_at) desc)
    from public.clientes_gestao cliente
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'plataforma', pe.plataforma,
        'utilizador', pe.utilizador,
        'url', pe.url_perfil
      ) order by pe.plataforma, pe.utilizador) as perfis
      from public.clientes_perfis_externos pe
      where pe.cliente_id = cliente.id
    ) perfis on true
    left join lateral (
      select count(*)::integer as encomendas,
             coalesce(sum(total) filter (where estado <> 'Cancelado'), 0) as total,
             max(created_at) as ultima_compra
      from public.encomendas encomenda
      where encomenda.cliente_gestao_id = cliente.id
    ) resumo on true
    where v_pesquisa = ''
       or lower(coalesce(cliente.nome, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.email, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.telefone, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.morada, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.cp, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.cidade, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.pais, '')) like '%' || v_pesquisa || '%'
       or lower(coalesce(cliente.notas, '')) like '%' || v_pesquisa || '%'
       or exists (
         select 1
         from public.clientes_perfis_externos pe
         where pe.cliente_id = cliente.id
           and (
             lower(pe.url_perfil) like '%' || v_pesquisa || '%'
             or lower(pe.utilizador) like '%' || v_pesquisa || '%'
             or lower(pe.plataforma) like '%' || v_pesquisa || '%'
           )
       )
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_clientes_admin(text) from public, anon;
grant execute on function public.listar_clientes_admin(text) to authenticated;
