-- Executar no SQL Editor do Supabase.
-- Regista encomendas externas e desconta o stock numa unica transacao.

alter table public.produtos add column if not exists referencia text;
alter table public.produtos add column if not exists top text;
alter table public.produtos add column if not exists fornecedores jsonb not null default '{}'::jsonb;

alter table public.encomendas
  add column if not exists origem text not null default 'Site',
  add column if not exists referencia_externa text,
  add column if not exists stock_reposto boolean not null default false;

alter table public.encomendas alter column id_cliente drop not null;

create or replace function public.listar_produtos_plataforma_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', produto.id,
      'referencia', produto.referencia,
      'sku', produto.sku,
      'nome', produto.nome,
      'preco', coalesce(produto.preco, 0),
      'top', coalesce(produto.top, ''),
      'peso', coalesce(produto.peso, 10),
      'imagens', produto.imagens,
      'stock', coalesce(produto.stock, 0),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb),
      'ativo', coalesce(produto.ativo, true)
    ) order by produto.nome)
    from public.produtos as produto
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_produtos_plataforma_admin() from public, anon;
grant execute on function public.listar_produtos_plataforma_admin() to authenticated;

create or replace function public.criar_encomenda_plataforma_admin(
  p_plataforma text,
  p_itens jsonb,
  p_nome_cliente text,
  p_referencia_externa text default null,
  p_regiao_envio text default null,
  p_metodo_envio text default null,
  p_metodo_envio_nome text default null,
  p_portes numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_produto record;
  v_plataforma text;
  v_indisponiveis jsonb := '[]'::jsonb;
  v_produtos jsonb := '[]'::jsonb;
  v_produtos_texto text := '';
  v_subtotal numeric := 0;
  v_portes numeric := 0;
  v_peso_total numeric := 0;
  v_codigo text;
  v_encomenda public.encomendas%rowtype;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  v_plataforma := case lower(trim(coalesce(p_plataforma, '')))
    when 'wallapop' then 'Wallapop'
    when 'olx' then 'OLX'
    when 'todocoleccion' then 'Todocoleccion'
    else null
  end;

  if v_plataforma is null then
    raise exception 'Plataforma invalida';
  end if;
  if nullif(trim(p_nome_cliente), '') is null then
    raise exception 'Indique o nome do cliente';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um produto';
  end if;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade,
           bool_or(coalesce((item->>'permitir_stock_negativo')::boolean, false)) as permitir_stock_negativo
    from jsonb_array_elements(p_itens) as itens(item)
    group by item->>'id_produto'
    order by item->>'id_produto'
  loop
    if v_item.id_produto is null or v_item.quantidade is null
       or v_item.quantidade < 1 or v_item.quantidade > 99 then
      raise exception 'Lista de produtos invalida';
    end if;

    select produto.id::text as id, produto.nome, produto.sku,
           coalesce(produto.preco, 0)::numeric as preco,
           coalesce(produto.peso, 10)::numeric as peso,
           coalesce(produto.stock, 0)::integer as stock,
           coalesce(produto.ativo, true) as ativo
    into v_produto
    from public.produtos as produto
    where produto.id::text = v_item.id_produto
    for update;

    if not found then
      v_indisponiveis := v_indisponiveis || jsonb_build_array(
        jsonb_build_object('id_produto', v_item.id_produto, 'nome', 'Produto indisponivel')
      );
    elsif (not v_produto.ativo or v_produto.stock < v_item.quantidade)
          and not v_item.permitir_stock_negativo then
      v_indisponiveis := v_indisponiveis || jsonb_build_array(
        jsonb_build_object(
          'id_produto', v_item.id_produto,
          'nome', v_produto.nome,
          'pedido', v_item.quantidade,
          'disponivel', greatest(v_produto.stock, 0)
        )
      );
    end if;
  end loop;

  if jsonb_array_length(v_indisponiveis) > 0 then
    return jsonb_build_object('sucesso', false, 'produtos_sem_stock', v_indisponiveis);
  end if;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade,
           min((item->>'ordem')::integer) as ordem
    from jsonb_array_elements(p_itens) as itens(item)
    group by item->>'id_produto'
    order by ordem
  loop
    select produto.id::text as id, produto.nome, produto.sku,
           coalesce(produto.preco, 0)::numeric as preco,
           coalesce(produto.peso, 10)::numeric as peso
    into v_produto
    from public.produtos as produto
    where produto.id::text = v_item.id_produto;

    v_produtos := v_produtos || jsonb_build_array(jsonb_build_object(
      'id_produto', v_produto.id,
      'nome', v_produto.nome,
      'referencia', v_produto.referencia,
      'sku', v_produto.sku,
      'quantidade', v_item.quantidade,
      'preco_unitario', v_produto.preco,
      'subtotal', v_produto.preco * v_item.quantidade
    ));
    v_produtos_texto := v_produtos_texto
      || case when v_produtos_texto = '' then '' else E'\n' end
      || v_item.quantidade || E'\t' || v_produto.nome || E'\t' || coalesce(v_produto.sku, '');
    v_subtotal := v_subtotal + (v_produto.preco * v_item.quantidade);
    v_peso_total := v_peso_total + (v_produto.peso * v_item.quantidade);
  end loop;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade
    from jsonb_array_elements(p_itens) as itens(item)
    group by item->>'id_produto'
  loop
    update public.produtos
    set stock = coalesce(stock, 0) - v_item.quantidade,
        ativo = (coalesce(stock, 0) - v_item.quantidade) > 0
    where id::text = v_item.id_produto;
  end loop;

  if v_plataforma = 'OLX' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio OLX';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  else
    v_portes := 0;
  end if;

  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.encomendas where codigo_encomenda = v_codigo);
  end loop;

  insert into public.encomendas (
    codigo_encomenda, id_cliente, nome_cliente, produtos, produtos_texto,
    produtos_texto_cliente, regiao_envio, metodo_envio, metodo_envio_nome,
    portes, peso_total, total, metodo_pagamento, estado, origem, referencia_externa
  ) values (
    v_codigo,
    null,
    trim(p_nome_cliente),
    v_produtos,
    v_produtos_texto,
    v_produtos_texto,
    case when v_plataforma = 'OLX' then coalesce(nullif(trim(p_regiao_envio), ''), 'portugal') else lower(v_plataforma) end,
    case when v_plataforma = 'OLX' then trim(p_metodo_envio) else lower(v_plataforma) end,
    case when v_plataforma = 'OLX' then trim(p_metodo_envio_nome) else v_plataforma end,
    v_portes,
    v_peso_total,
    v_subtotal + v_portes,
    v_plataforma,
    'A aguardar pagamento',
    v_plataforma,
    nullif(trim(p_referencia_externa), '')
  ) returning * into v_encomenda;

  return jsonb_build_object('sucesso', true, 'encomenda', to_jsonb(v_encomenda));
end;
$$;

revoke execute on function public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric
) from public, anon;

grant execute on function public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric
) to authenticated;

create or replace function public.cancelar_encomenda_plataforma_admin(
  p_encomenda_id text,
  p_repor_stock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_item jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id::text = p_encomenda_id
  for update;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;
  if lower(coalesce(v_encomenda.origem, 'site')) not in ('wallapop', 'olx', 'todocoleccion') then
    raise exception 'Esta operacao destina-se a encomendas de plataformas externas';
  end if;

  if p_repor_stock and not coalesce(v_encomenda.stock_reposto, false) then
    for v_item in select value from jsonb_array_elements(v_encomenda.produtos)
    loop
      update public.produtos
    set stock = coalesce(stock, 0) + greatest(1, coalesce((v_item->>'quantidade')::integer, 1)),
          ativo = (coalesce(stock, 0) + greatest(1, coalesce((v_item->>'quantidade')::integer, 1))) > 0
      where id::text = v_item->>'id_produto';
    end loop;
    v_encomenda.stock_reposto := true;
  end if;

  update public.encomendas
  set estado = 'Cancelado',
      stock_reposto = v_encomenda.stock_reposto
  where id::text = p_encomenda_id;

  return jsonb_build_object(
    'sucesso', true,
    'estado', 'Cancelado',
    'stock_reposto', v_encomenda.stock_reposto
  );
end;
$$;

revoke execute on function public.cancelar_encomenda_plataforma_admin(text, boolean)
from public, anon;

grant execute on function public.cancelar_encomenda_plataforma_admin(text, boolean)
to authenticated;

create or replace function public.obter_encomenda_plataforma_admin(
  p_codigo_encomenda text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_catalogo jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_encomenda
  from public.encomendas
  where upper(codigo_encomenda) = upper(trim(p_codigo_encomenda))
  limit 1;

  if not found then
    return jsonb_build_object('sucesso', false, 'erro', 'Encomenda nao encontrada');
  end if;
  if lower(coalesce(v_encomenda.origem, 'site')) not in ('wallapop', 'olx', 'todocoleccion') then
    return jsonb_build_object('sucesso', false, 'erro', 'A encomenda nao pertence a uma plataforma externa');
  end if;
  if lower(coalesce(v_encomenda.estado, '')) = 'cancelado' then
    return jsonb_build_object('sucesso', false, 'erro', 'Uma encomenda cancelada nao pode ser editada');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', produto.id::text,
    'referencia', produto.referencia,
    'sku', produto.sku,
    'nome', produto.nome,
    'preco', coalesce(produto.preco, 0),
    'peso', coalesce(produto.peso, 10),
    'imagens', produto.imagens,
    'ativo', coalesce(produto.ativo, true)
  ) order by itens.ordem), '[]'::jsonb)
  into v_catalogo
  from jsonb_array_elements(v_encomenda.produtos) with ordinality as itens(item, ordem)
  join public.produtos as produto on produto.id::text = itens.item->>'id_produto';

  return jsonb_build_object(
    'sucesso', true,
    'encomenda', to_jsonb(v_encomenda),
    'catalogo_itens', v_catalogo
  );
end;
$$;

revoke execute on function public.obter_encomenda_plataforma_admin(text)
from public, anon;

grant execute on function public.obter_encomenda_plataforma_admin(text)
to authenticated;

drop function if exists public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric
);

create or replace function public.atualizar_encomenda_plataforma_admin(
  p_encomenda_id text,
  p_itens jsonb,
  p_nome_cliente text,
  p_referencia_externa text default null,
  p_regiao_envio text default null,
  p_metodo_envio text default null,
  p_metodo_envio_nome text default null,
  p_portes numeric default 0,
  p_nao_repor_ids text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_item record;
  v_produto record;
  v_quantidade_antiga integer;
  v_quantidade_nova integer;
  v_nao_repor integer;
  v_disponivel integer;
  v_indisponiveis jsonb := '[]'::jsonb;
  v_produtos jsonb := '[]'::jsonb;
  v_produtos_texto text := '';
  v_subtotal numeric := 0;
  v_portes numeric := 0;
  v_peso_total numeric := 0;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;
  if nullif(trim(p_nome_cliente), '') is null then
    raise exception 'Indique o nome do cliente';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um produto';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id::text = p_encomenda_id
  for update;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;
  if lower(coalesce(v_encomenda.origem, 'site')) not in ('wallapop', 'olx', 'todocoleccion') then
    raise exception 'Esta encomenda nao pertence a uma plataforma externa';
  end if;
  if lower(coalesce(v_encomenda.estado, '')) = 'cancelado' then
    raise exception 'Uma encomenda cancelada nao pode ser editada';
  end if;

  perform 1
  from public.produtos as produto
  where produto.id::text in (
    select item->>'id_produto' from jsonb_array_elements(v_encomenda.produtos) as antigos(item)
    union
    select item->>'id_produto' from jsonb_array_elements(p_itens) as novos(item)
  )
  order by produto.id::text
  for update;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade,
           bool_or(coalesce((item->>'permitir_stock_negativo')::boolean, false)) as permitir_stock_negativo
    from jsonb_array_elements(p_itens) as itens(item)
    group by item->>'id_produto'
    order by item->>'id_produto'
  loop
    if v_item.id_produto is null or v_item.quantidade is null
       or v_item.quantidade < 1 or v_item.quantidade > 99 then
      raise exception 'Lista de produtos invalida';
    end if;

    select produto.id::text as id, produto.nome,
           coalesce(produto.stock, 0)::integer as stock,
           coalesce(produto.ativo, true) as ativo
    into v_produto
    from public.produtos as produto
    where produto.id::text = v_item.id_produto;

    select coalesce(sum(greatest(1, coalesce((antigo.item->>'quantidade')::integer, 1))), 0)::integer
    into v_quantidade_antiga
    from jsonb_array_elements(v_encomenda.produtos) as antigo(item)
    where antigo.item->>'id_produto' = v_item.id_produto;

    v_nao_repor := case
      when v_item.id_produto = any(coalesce(p_nao_repor_ids, array[]::text[]))
      then greatest(v_quantidade_antiga - v_item.quantidade, 0)
      else 0
    end;

    if not found or v_produto.id is null then
      v_indisponiveis := v_indisponiveis || jsonb_build_array(
        jsonb_build_object('id_produto', v_item.id_produto, 'nome', 'Produto indisponivel')
      );
    else
      v_disponivel := v_quantidade_antiga + greatest(v_produto.stock, 0) - v_nao_repor;
      if v_disponivel < v_item.quantidade and not v_item.permitir_stock_negativo then
        v_indisponiveis := v_indisponiveis || jsonb_build_array(jsonb_build_object(
          'id_produto', v_item.id_produto,
          'nome', v_produto.nome,
          'pedido', v_item.quantidade,
          'disponivel', v_disponivel
        ));
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_indisponiveis) > 0 then
    return jsonb_build_object('sucesso', false, 'produtos_sem_stock', v_indisponiveis);
  end if;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum(greatest(1, coalesce((item->>'quantidade')::integer, 1)))::integer as quantidade
    from jsonb_array_elements(v_encomenda.produtos) as antigos(item)
    group by item->>'id_produto'
  loop
    select coalesce(sum((novo.item->>'quantidade')::integer), 0)::integer
    into v_quantidade_nova
    from jsonb_array_elements(p_itens) as novo(item)
    where novo.item->>'id_produto' = v_item.id_produto;

    v_nao_repor := case
      when v_item.id_produto = any(coalesce(p_nao_repor_ids, array[]::text[]))
      then greatest(v_item.quantidade - v_quantidade_nova, 0)
      else 0
    end;

    update public.produtos
    set stock = coalesce(stock, 0) + greatest(v_item.quantidade - v_nao_repor, 0),
        ativo = (coalesce(stock, 0) + greatest(v_item.quantidade - v_nao_repor, 0)) > 0
    where id::text = v_item.id_produto;
  end loop;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade,
           min((item->>'ordem')::integer) as ordem
    from jsonb_array_elements(p_itens) as itens(item)
    group by item->>'id_produto'
    order by ordem
  loop
    select produto.id::text as id, produto.nome, produto.sku,
           coalesce(produto.preco, 0)::numeric as preco,
           coalesce(produto.peso, 10)::numeric as peso
    into v_produto
    from public.produtos as produto
    where produto.id::text = v_item.id_produto;

    v_produtos := v_produtos || jsonb_build_array(jsonb_build_object(
      'id_produto', v_produto.id,
      'nome', v_produto.nome,
      'referencia', v_produto.referencia,
      'sku', v_produto.sku,
      'quantidade', v_item.quantidade,
      'preco_unitario', v_produto.preco,
      'subtotal', v_produto.preco * v_item.quantidade
    ));
    v_produtos_texto := v_produtos_texto
      || case when v_produtos_texto = '' then '' else E'\n' end
      || v_item.quantidade || E'\t' || v_produto.nome || E'\t' || coalesce(v_produto.sku, '');
    v_subtotal := v_subtotal + (v_produto.preco * v_item.quantidade);
    v_peso_total := v_peso_total + (v_produto.peso * v_item.quantidade);

    update public.produtos
    set stock = coalesce(stock, 0) - v_item.quantidade,
        ativo = (coalesce(stock, 0) - v_item.quantidade) > 0
    where id::text = v_item.id_produto;
  end loop;

  if upper(v_encomenda.origem) = 'OLX' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio OLX';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  end if;

  update public.encomendas
  set nome_cliente = trim(p_nome_cliente),
      produtos = v_produtos,
      produtos_texto = v_produtos_texto,
      produtos_texto_cliente = v_produtos_texto,
      regiao_envio = case when upper(v_encomenda.origem) = 'OLX'
        then coalesce(nullif(trim(p_regiao_envio), ''), 'portugal') else lower(v_encomenda.origem) end,
      metodo_envio = case when upper(v_encomenda.origem) = 'OLX'
        then trim(p_metodo_envio) else lower(v_encomenda.origem) end,
      metodo_envio_nome = case when upper(v_encomenda.origem) = 'OLX'
        then trim(p_metodo_envio_nome) else v_encomenda.origem end,
      portes = v_portes,
      peso_total = v_peso_total,
      total = v_subtotal + v_portes,
      referencia_externa = nullif(trim(p_referencia_externa), ''),
      stock_reposto = false
  where id::text = p_encomenda_id
  returning * into v_encomenda;

  return jsonb_build_object('sucesso', true, 'encomenda', to_jsonb(v_encomenda));
end;
$$;

revoke execute on function public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text[]
) from public, anon;

grant execute on function public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text[]
) to authenticated;
