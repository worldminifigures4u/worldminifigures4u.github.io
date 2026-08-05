-- Executar no SQL Editor do Supabase.
-- Mostra no historico da ficha de cliente todas as encomendas associadas,
-- incluindo canceladas, por cliente_gestao_id, id_cliente ou email.

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
  if not public.is_admin() then
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
  if not public.is_admin() then
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

revoke execute on function public.vincular_encomendas_cliente_gestao(uuid) from public, anon, authenticated;
grant execute on function public.vincular_encomendas_cliente_gestao(uuid) to authenticated;
