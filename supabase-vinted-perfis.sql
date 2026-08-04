-- Reconhecer links de perfil Vinted nas fichas de cliente.
-- Executar no SQL Editor do Supabase.

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
      auth_user_id, nome_utilizador, nome, email, telefone, morada, cp, cidade, pais
    ) values (
      v_encomenda.id_cliente, v_utilizador, nullif(trim(v_encomenda.nome_cliente), ''),
      nullif(trim(v_encomenda.email_cliente), ''), nullif(trim(v_encomenda.telefone_cliente), ''),
      nullif(trim(v_encomenda.morada_cliente), ''), nullif(trim(v_encomenda.cp_cliente), ''),
      nullif(trim(v_encomenda.cidade_cliente), ''), nullif(trim(v_encomenda.pais_cliente), '')
    ) returning * into v_cliente;
  end if;

  update public.clientes_gestao set
    nome_utilizador = coalesce(nullif(trim(nome_utilizador), ''), v_utilizador),
    nome = coalesce(nullif(trim(v_encomenda.nome_cliente), ''), nome),
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
