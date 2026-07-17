-- Executar no SQL Editor do Supabase.
-- Permite recuperar encomendas canceladas, reduzindo novamente o stock quando aplicavel.

alter table public.encomendas
add column if not exists stock_reposto boolean not null default false;

create or replace function public.recuperar_encomenda_admin(
  p_encomenda_id text,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_item record;
  v_produto public.produtos%rowtype;
  v_quantidade integer;
  v_stock_atual integer;
  v_stock_era_reposto boolean;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if p_estado not in (
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído'
  ) then
    raise exception 'Estado invalido para recuperacao';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id::text = p_encomenda_id
  for update;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;

  if lower(coalesce(v_encomenda.estado, '')) <> 'cancelado' then
    raise exception 'A encomenda nao esta cancelada';
  end if;

  v_stock_era_reposto := coalesce(v_encomenda.stock_reposto, false);

  if v_stock_era_reposto then
    for v_item in
      select
        coalesce(nullif(item->>'id_produto', ''), nullif(item->>'id', '')) as id_produto,
        sum(
          greatest(
            1,
            coalesce(
              nullif(item->>'quantidade', '')::integer,
              nullif(item->>'qtd', '')::integer,
              1
            )
          )
        )::integer as quantidade
      from jsonb_array_elements(coalesce(v_encomenda.produtos, '[]'::jsonb)) as item
      group by 1
    loop
      if v_item.id_produto is null then
        continue;
      end if;

      v_quantidade := greatest(coalesce(v_item.quantidade, 1), 1);

      select * into v_produto
      from public.produtos
      where id::text = v_item.id_produto
      for update;

      if not found then
        raise exception 'Produto % da encomenda nao encontrado', v_item.id_produto;
      end if;

      v_stock_atual := coalesce(v_produto.stock, 0);
      if v_stock_atual < v_quantidade then
        raise exception 'Stock insuficiente para "%" (disponivel: %, necessario: %)',
          coalesce(v_produto.nome, v_item.id_produto),
          v_stock_atual,
          v_quantidade;
      end if;

      update public.produtos
      set stock = v_stock_atual - v_quantidade,
          ativo = (v_stock_atual - v_quantidade) > 0
      where id::text = v_item.id_produto;
    end loop;
  end if;

  update public.encomendas
  set estado = p_estado,
      stock_reposto = false
  where id::text = p_encomenda_id
  returning * into v_encomenda;

  return jsonb_build_object(
    'sucesso', true,
    'estado', p_estado,
    'stock_reposto', false,
    'stock_reduzido', v_stock_era_reposto
  );
end;
$$;

revoke execute on function public.recuperar_encomenda_admin(text, text)
from public, anon;

grant execute on function public.recuperar_encomenda_admin(text, text)
to authenticated;

-- Atualizar cancelamento para funcionar tambem em encomendas do site
-- e repor stock com id_produto ou id.
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
  v_item record;
  v_produto public.produtos%rowtype;
  v_quantidade integer;
  v_stock_atual integer;
  v_repostou_agora boolean := false;
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

  if not coalesce(v_encomenda.stock_reposto, false) then
    v_repostou_agora := true;
    for v_item in
      select
        coalesce(nullif(item->>'id_produto', ''), nullif(item->>'id', '')) as id_produto,
        sum(
          greatest(
            1,
            coalesce(
              nullif(item->>'quantidade', '')::integer,
              nullif(item->>'qtd', '')::integer,
              1
            )
          )
        )::integer as quantidade
      from jsonb_array_elements(coalesce(v_encomenda.produtos, '[]'::jsonb)) as item
      group by 1
    loop
      if v_item.id_produto is null then
        raise exception 'Produto da encomenda sem id para repor stock';
      end if;

      v_quantidade := greatest(coalesce(v_item.quantidade, 1), 1);

      select * into v_produto
      from public.produtos
      where id::text = v_item.id_produto
      for update;

      if not found then
        raise exception 'Produto % da encomenda nao encontrado para repor stock', v_item.id_produto;
      end if;

      v_stock_atual := coalesce(v_produto.stock, 0);

      update public.produtos
      set stock = v_stock_atual + v_quantidade,
          ativo = (v_stock_atual + v_quantidade) > 0
      where id::text = v_item.id_produto;
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
    'stock_reposto', v_encomenda.stock_reposto,
    'stock_reposto_agora', v_repostou_agora
  );
end;
$$;

revoke execute on function public.cancelar_encomenda_plataforma_admin(text, boolean)
from public, anon;

grant execute on function public.cancelar_encomenda_plataforma_admin(text, boolean)
to authenticated;
