-- Executar no SQL Editor do Supabase.
-- Auditoria so-leitura para procurar inconsistencias que podem afetar stock.

-- 1) Encomendas canceladas sem stock_reposto=true.
select
  id,
  codigo_encomenda,
  estado,
  origem,
  stock_reposto,
  created_at
from public.encomendas
where lower(coalesce(estado, '')) = 'cancelado'
  and coalesce(stock_reposto, false) = false
order by created_at desc;

-- 2) Encomendas nao canceladas marcadas com stock_reposto=true.
select
  id,
  codigo_encomenda,
  estado,
  origem,
  stock_reposto,
  created_at
from public.encomendas
where lower(coalesce(estado, '')) <> 'cancelado'
  and coalesce(stock_reposto, false) = true
order by created_at desc;

-- 3) Produtos em encomendas cujo id ja nao existe no catalogo.
with itens as (
  select
    e.id as encomenda_id,
    e.codigo_encomenda,
    e.estado,
    e.origem,
    coalesce(nullif(item->>'id_produto', ''), nullif(item->>'id', '')) as produto_id,
    item
  from public.encomendas e
  cross join lateral jsonb_array_elements(coalesce(e.produtos, '[]'::jsonb)) as item
)
select
  i.encomenda_id,
  i.codigo_encomenda,
  i.estado,
  i.origem,
  i.produto_id,
  i.item
from itens i
left join public.produtos p on p.id::text = i.produto_id
where i.produto_id is null
   or p.id is null
order by i.codigo_encomenda;

-- 4) Itens de encomenda com quantidade invalida ou nao numerica.
with itens as (
  select
    e.id as encomenda_id,
    e.codigo_encomenda,
    e.estado,
    coalesce(nullif(item->>'id_produto', ''), nullif(item->>'id', '')) as produto_id,
    coalesce(nullif(item->>'quantidade', ''), nullif(item->>'qtd', '')) as quantidade_raw,
    item
  from public.encomendas e
  cross join lateral jsonb_array_elements(coalesce(e.produtos, '[]'::jsonb)) as item
)
select *
from itens
where quantidade_raw is null
   or quantidade_raw !~ '^[0-9]+$'
   or quantidade_raw::integer < 1
   or quantidade_raw::integer > 99
order by codigo_encomenda;

-- 5) Encomendas de fornecedor com recebido acima do pedido.
with itens as (
  select
    f.id as fornecedor_id,
    f.codigo,
    f.estado,
    item->>'id' as produto_id,
    greatest(0, coalesce((item->>'quantidade')::int, 0)) as quantidade,
    greatest(0, coalesce((item->>'recebido')::int, 0)) as recebido,
    item
  from public.encomendas_fornecedores f
  cross join lateral jsonb_array_elements(coalesce(f.itens, '[]'::jsonb)) as item
)
select *
from itens
where recebido > quantidade
order by codigo;

-- 6) Produtos com stock negativo ainda ativos como vendidos no site.
select
  id,
  sku,
  nome,
  stock,
  ativo
from public.produtos
where coalesce(stock, 0) < 0
   or (coalesce(stock, 0) <= 0 and coalesce(ativo, true) = true)
order by stock asc, sku;
