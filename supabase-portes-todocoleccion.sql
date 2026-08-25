-- Historico de portes/total Todocoleccion. Mantem as funcoes de plataforma alinhadas com supabase-vinted-plataforma.sql.
-- Executar no SQL Editor do Supabase.

drop function if exists public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric
);
drop function if exists public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text
);
drop function if exists public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, numeric
);

create or replace function public.criar_encomenda_plataforma_admin(
  p_plataforma text,
  p_itens jsonb,
  p_nome_cliente text,
  p_referencia_externa text default null,
  p_regiao_envio text default null,
  p_metodo_envio text default null,
  p_metodo_envio_nome text default null,
  p_portes numeric default 0,
  p_telefone_cliente text default null,
  p_morada_cliente text default null,
  p_cp_cliente text default null,
  p_cidade_cliente text default null,
  p_pais_cliente text default null,
  p_total numeric default null
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
  v_total numeric := 0;
  v_peso_total numeric := 0;
  v_codigo text;
  v_encomenda public.encomendas%rowtype;
  v_cliente_gestao_id uuid;
  v_cliente_nome text;
  v_telefone_normalizado text;
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  v_plataforma := case lower(trim(coalesce(p_plataforma, '')))
    when 'wallapop' then 'Wallapop'
    when 'vinted' then 'Vinted'
    when 'olx' then 'OLX'
    when 'todocoleccion' then 'Todocoleccion'
    when 'whatsapp' then 'WhatsApp'
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

    select produto.id::text as id, produto.nome, produto.referencia, produto.sku,
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
    select produto.id::text as id, produto.nome, produto.referencia, produto.sku,
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
  elsif v_plataforma = 'Todocoleccion' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio Todocoleccion';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  elsif v_plataforma = 'WhatsApp' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio WhatsApp';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  else
    v_portes := 0;
  end if;

  if v_plataforma = 'Todocoleccion' and p_total is not null then
    v_total := greatest(0, round(p_total::numeric, 2));
  else
    v_total := v_subtotal + v_portes;
  end if;

  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.encomendas where codigo_encomenda = v_codigo);
  end loop;

  v_telefone_normalizado := regexp_replace(coalesce(p_telefone_cliente, ''), '\D', '', 'g');
  if length(v_telefone_normalizado) >= 9 then
    select cg.id, coalesce(nullif(trim(cg.nome_utilizador), ''), nullif(trim(cg.nome), ''))
    into v_cliente_gestao_id, v_cliente_nome
    from public.clientes_gestao cg
    where regexp_replace(coalesce(cg.telefone, ''), '\D', '', 'g') = v_telefone_normalizado
    order by cg.updated_at desc nulls last, cg.created_at desc nulls last
    limit 1;
  end if;

  insert into public.encomendas (
    codigo_encomenda, id_cliente, cliente_gestao_id, nome_cliente, produtos, produtos_texto,
    produtos_texto_cliente, regiao_envio, metodo_envio, metodo_envio_nome,
    portes, peso_total, total, metodo_pagamento, estado, origem, referencia_externa,
    telefone_cliente, morada_cliente, cp_cliente, cidade_cliente, pais_cliente
  ) values (
    v_codigo,
    null,
    v_cliente_gestao_id,
    coalesce(v_cliente_nome, trim(p_nome_cliente)),
    v_produtos,
    v_produtos_texto,
    v_produtos_texto,
    case when v_plataforma in ('OLX', 'Todocoleccion', 'WhatsApp') then coalesce(nullif(trim(p_regiao_envio), ''), 'portugal') else lower(v_plataforma) end,
    case when v_plataforma in ('OLX', 'Todocoleccion', 'WhatsApp') then trim(p_metodo_envio) else lower(v_plataforma) end,
    case when v_plataforma in ('OLX', 'Todocoleccion', 'WhatsApp') then trim(p_metodo_envio_nome) else v_plataforma end,
    v_portes,
    v_peso_total,
    v_total,
    v_plataforma,
    'A aguardar pagamento',
    v_plataforma,
    nullif(trim(p_referencia_externa), ''),
    nullif(trim(coalesce(p_telefone_cliente, '')), ''),
    nullif(trim(coalesce(p_morada_cliente, '')), ''),
    nullif(trim(coalesce(p_cp_cliente, '')), ''),
    nullif(trim(coalesce(p_cidade_cliente, '')), ''),
    nullif(trim(coalesce(p_pais_cliente, '')), '')
  ) returning * into v_encomenda;

  return jsonb_build_object('sucesso', true, 'encomenda', to_jsonb(v_encomenda));
end;
$$;

revoke execute on function public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, numeric
) from public, anon;

grant execute on function public.criar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, numeric
) to authenticated;

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
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select * into v_encomenda
  from public.encomendas
  where upper(codigo_encomenda) = upper(trim(p_codigo_encomenda))
  limit 1;

  if not found then
    return jsonb_build_object('sucesso', false, 'erro', 'Encomenda nao encontrada');
  end if;
  if lower(coalesce(v_encomenda.origem, 'site')) not in ('wallapop', 'vinted', 'olx', 'todocoleccion', 'whatsapp') then
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
    'stock', coalesce(produto.stock, 0),
    'ativo', coalesce(produto.ativo, true)
  ) order by itens.ordem), '[]'::jsonb)
  into v_catalogo
  from jsonb_array_elements(v_encomenda.produtos) with ordinality as itens(item, ordem)
  join public.produtos as produto
    on produto.id::text = coalesce(nullif(itens.item->>'id_produto', ''), nullif(itens.item->>'id', ''));

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
drop function if exists public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text[]
);
drop function if exists public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, text[]
);
drop function if exists public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, text[], numeric
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
  p_telefone_cliente text default null,
  p_morada_cliente text default null,
  p_cp_cliente text default null,
  p_cidade_cliente text default null,
  p_pais_cliente text default null,
  p_nao_repor_ids text[] default array[]::text[],
  p_total numeric default null
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
  v_total numeric := 0;
  v_peso_total numeric := 0;
  v_cliente_gestao_id uuid;
  v_cliente_nome text;
  v_telefone_normalizado text;
begin
  if not public.is_admin() then
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
  if lower(coalesce(v_encomenda.origem, 'site')) not in ('wallapop', 'vinted', 'olx', 'todocoleccion', 'whatsapp') then
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
    select produto.id::text as id, produto.nome, produto.referencia, produto.sku,
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
  elsif upper(v_encomenda.origem) = 'TODOCOLECCION' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio Todocoleccion';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  elsif upper(v_encomenda.origem) = 'WHATSAPP' then
    if nullif(trim(coalesce(p_metodo_envio, '')), '') is null
       or nullif(trim(coalesce(p_metodo_envio_nome, '')), '') is null then
      raise exception 'Selecione o metodo de envio WhatsApp';
    end if;
    v_portes := greatest(0, round(coalesce(p_portes, 0)::numeric, 2));
  end if;

  if upper(v_encomenda.origem) = 'TODOCOLECCION' and p_total is not null then
    v_total := greatest(0, round(p_total::numeric, 2));
  else
    v_total := v_subtotal + v_portes;
  end if;

  v_telefone_normalizado := regexp_replace(coalesce(p_telefone_cliente, ''), '\D', '', 'g');
  if length(v_telefone_normalizado) >= 9 then
    select cg.id, coalesce(nullif(trim(cg.nome_utilizador), ''), nullif(trim(cg.nome), ''))
    into v_cliente_gestao_id, v_cliente_nome
    from public.clientes_gestao cg
    where regexp_replace(coalesce(cg.telefone, ''), '\D', '', 'g') = v_telefone_normalizado
    order by cg.updated_at desc nulls last, cg.created_at desc nulls last
    limit 1;
  end if;

  if v_cliente_nome is null and v_encomenda.cliente_gestao_id is not null then
    select coalesce(nullif(trim(cg.nome_utilizador), ''), nullif(trim(cg.nome), ''))
    into v_cliente_nome
    from public.clientes_gestao cg
    where cg.id = v_encomenda.cliente_gestao_id
    limit 1;
  end if;

  update public.encomendas
  set nome_cliente = coalesce(v_cliente_nome, trim(p_nome_cliente)),
      cliente_gestao_id = coalesce(v_encomenda.cliente_gestao_id, v_cliente_gestao_id),
      produtos = v_produtos,
      produtos_texto = v_produtos_texto,
      produtos_texto_cliente = v_produtos_texto,
      regiao_envio = case when upper(v_encomenda.origem) in ('OLX', 'TODOCOLECCION', 'WHATSAPP')
        then coalesce(nullif(trim(p_regiao_envio), ''), 'portugal') else lower(v_encomenda.origem) end,
      metodo_envio = case when upper(v_encomenda.origem) in ('OLX', 'TODOCOLECCION', 'WHATSAPP')
        then trim(p_metodo_envio) else lower(v_encomenda.origem) end,
      metodo_envio_nome = case when upper(v_encomenda.origem) in ('OLX', 'TODOCOLECCION', 'WHATSAPP')
        then trim(p_metodo_envio_nome) else v_encomenda.origem end,
      portes = v_portes,
      peso_total = v_peso_total,
      total = v_total,
      referencia_externa = nullif(trim(p_referencia_externa), ''),
      telefone_cliente = nullif(trim(coalesce(p_telefone_cliente, '')), ''),
      morada_cliente = nullif(trim(coalesce(p_morada_cliente, '')), ''),
      cp_cliente = nullif(trim(coalesce(p_cp_cliente, '')), ''),
      cidade_cliente = nullif(trim(coalesce(p_cidade_cliente, '')), ''),
      pais_cliente = nullif(trim(coalesce(p_pais_cliente, '')), ''),
      stock_reposto = false
  where id::text = p_encomenda_id
  returning * into v_encomenda;

  return jsonb_build_object('sucesso', true, 'encomenda', to_jsonb(v_encomenda));
end;
$$;

revoke execute on function public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, text[], numeric
) from public, anon;

grant execute on function public.atualizar_encomenda_plataforma_admin(
  text, jsonb, text, text, text, text, text, numeric, text, text, text, text, text, text[], numeric
) to authenticated;
