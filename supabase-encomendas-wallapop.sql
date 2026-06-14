-- Executar no SQL Editor do Supabase.
-- Regista encomendas Wallapop e desconta o stock numa unica transacao.

alter table public.encomendas
  add column if not exists origem text not null default 'Site',
  add column if not exists referencia_externa text,
  add column if not exists stock_reposto boolean not null default false;

alter table public.encomendas alter column id_cliente drop not null;

create or replace function public.criar_encomenda_wallapop_admin(
  p_itens jsonb,
  p_nome_cliente text,
  p_referencia_externa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_produto record;
  v_indisponiveis jsonb := '[]'::jsonb;
  v_produtos jsonb := '[]'::jsonb;
  v_produtos_texto text := '';
  v_total numeric := 0;
  v_peso_total numeric := 0;
  v_codigo text;
  v_encomenda public.encomendas%rowtype;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if nullif(trim(p_nome_cliente), '') is null then
    raise exception 'Indique o nome do cliente Wallapop';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um produto';
  end if;

  for v_item in
    select item->>'id_produto' as id_produto,
           sum((item->>'quantidade')::integer)::integer as quantidade
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
    elsif not v_produto.ativo or v_produto.stock < v_item.quantidade then
      v_indisponiveis := v_indisponiveis || jsonb_build_array(
        jsonb_build_object('id_produto', v_item.id_produto, 'nome', v_produto.nome,
          'pedido', v_item.quantidade, 'disponivel', greatest(v_produto.stock, 0))
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
      'id_produto', v_produto.id, 'nome', v_produto.nome, 'sku', v_produto.sku,
      'quantidade', v_item.quantidade, 'preco_unitario', v_produto.preco,
      'subtotal', v_produto.preco * v_item.quantidade
    ));
    v_produtos_texto := v_produtos_texto
      || case when v_produtos_texto = '' then '' else E'\n' end
      || v_item.quantidade || E'\t' || v_produto.nome || E'\t' || coalesce(v_produto.sku, '');
    v_total := v_total + (v_produto.preco * v_item.quantidade);
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

  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.encomendas where codigo_encomenda = v_codigo);
  end loop;

  insert into public.encomendas (
    codigo_encomenda, id_cliente, nome_cliente, produtos, produtos_texto,
    produtos_texto_cliente, regiao_envio, metodo_envio, metodo_envio_nome,
    portes, peso_total, total, metodo_pagamento, estado, origem, referencia_externa
  ) values (
    v_codigo, null, trim(p_nome_cliente), v_produtos, v_produtos_texto,
    v_produtos_texto, 'wallapop', 'wallapop', 'Wallapop',
    0, v_peso_total, v_total, 'Wallapop', 'A aguardar pagamento',
    'Wallapop', nullif(trim(p_referencia_externa), '')
  ) returning * into v_encomenda;

  return jsonb_build_object('sucesso', true, 'encomenda', to_jsonb(v_encomenda));
end;
$$;

revoke execute on function public.criar_encomenda_wallapop_admin(jsonb, text, text)
from public, anon;

grant execute on function public.criar_encomenda_wallapop_admin(jsonb, text, text)
to authenticated;

create or replace function public.cancelar_encomenda_wallapop_admin(
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
  if coalesce(v_encomenda.origem, 'Site') <> 'Wallapop' then
    raise exception 'Esta operacao destina-se a encomendas Wallapop';
  end if;

  if p_repor_stock and not coalesce(v_encomenda.stock_reposto, false) then
    for v_item in select value from jsonb_array_elements(v_encomenda.produtos)
    loop
      update public.produtos
      set stock = coalesce(stock, 0) + greatest(1, coalesce((v_item->>'quantidade')::integer, 1)),
          ativo = true
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

revoke execute on function public.cancelar_encomenda_wallapop_admin(text, boolean)
from public, anon;

grant execute on function public.cancelar_encomenda_wallapop_admin(text, boolean)
to authenticated;
