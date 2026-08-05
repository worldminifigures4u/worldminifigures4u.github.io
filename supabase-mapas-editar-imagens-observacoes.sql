-- Mapas: incluir imagens, observacoes e fornecedores na listagem e na edicao.
-- Executar no SQL Editor do Supabase (uma vez).

create or replace function public.listar_produtos_mapas_admin(
  p_limite integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', produto.id,
      'referencia', produto.referencia,
      'lego', coalesce(produto.lego, ''),
      'sku', produto.sku,
      'nome', produto.nome,
      'preco', coalesce(produto.preco, 0),
      'preco_compra', coalesce(produto.preco_compra, 0),
      'top', coalesce(produto.top, ''),
      'arquivado', coalesce(produto.arquivado, false),
      'descontinuado', coalesce(produto.descontinuado, false),
      'novidade', coalesce(produto.novidade, false),
      'peso', coalesce(produto.peso, 10),
      'tema', coalesce(produto.tema, ''),
      'subtema', coalesce(produto.subtema, ''),
      'stock', coalesce(produto.stock, 0),
      'ativo', coalesce(produto.ativo, true),
      'observacoes', coalesce(produto.observacoes, ''),
      'imagens', coalesce(to_jsonb(produto.imagens), '[]'::jsonb),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb)
    ) order by produto.nome)
    from (
      select *
      from public.produtos
      order by nome, sku
      limit greatest(coalesce(p_limite, 500), 1)
      offset greatest(coalesce(p_offset, 0), 0)
    ) as produto
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_produtos_mapas_admin(integer, integer)
from public, anon;
grant execute on function public.listar_produtos_mapas_admin(integer, integer)
to authenticated;

create or replace function public.editar_produto_mapa_admin(
  p_id text,
  p_sku_original text,
  p_produto jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.produtos%rowtype;
  v_imagens json[];
  v_sku text;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  if p_produto is null or jsonb_typeof(p_produto) <> 'object' then
    raise exception 'Produto invalido.';
  end if;

  v_sku := upper(trim(coalesce(p_produto->>'sku', '')));
  if v_sku = '' then
    raise exception 'SKU invalido.';
  end if;

  select coalesce(array_agg(to_json(trim(valor))), array[]::json[])
  into v_imagens
  from jsonb_array_elements_text(coalesce(p_produto->'imagens', '[]'::jsonb)) as imagens(valor)
  where trim(valor) <> '';

  update public.produtos as produto
  set
    sku = v_sku,
    referencia = nullif(trim(coalesce(p_produto->>'referencia', '')), ''),
    lego = nullif(trim(coalesce(p_produto->>'lego', produto.lego, '')), ''),
    nome = trim(coalesce(p_produto->>'nome', '')),
    tema = trim(coalesce(p_produto->>'tema', '')),
    subtema = coalesce(nullif(trim(coalesce(p_produto->>'subtema', '')), ''), 'semsubtema'),
    preco = (p_produto->>'preco')::numeric,
    preco_compra = coalesce(nullif(trim(coalesce(p_produto->>'preco_compra', '')), '')::numeric, 0),
    peso = (p_produto->>'peso')::numeric,
    stock = (p_produto->>'stock')::integer,
    top = nullif(trim(coalesce(p_produto->>'top', '')), ''),
    arquivado = coalesce((p_produto->>'arquivado')::boolean, false),
    descontinuado = coalesce((p_produto->>'descontinuado')::boolean, false),
    observacoes = nullif(trim(coalesce(p_produto->>'observacoes', '')), ''),
    ativo = coalesce((p_produto->>'ativo')::boolean, true),
    novidade = coalesce((p_produto->>'novidade')::boolean, false),
    imagens = v_imagens,
    fornecedores = coalesce(p_produto->'fornecedores', produto.fornecedores, '{}'::jsonb)
  where nullif(trim(coalesce(p_id, '')), '') is not null
    and produto.id::text = trim(p_id)
  returning produto.*
  into v_produto;

  if not found then
    update public.produtos as produto
    set
      sku = v_sku,
      referencia = nullif(trim(coalesce(p_produto->>'referencia', '')), ''),
      lego = nullif(trim(coalesce(p_produto->>'lego', produto.lego, '')), ''),
      nome = trim(coalesce(p_produto->>'nome', '')),
      tema = trim(coalesce(p_produto->>'tema', '')),
      subtema = coalesce(nullif(trim(coalesce(p_produto->>'subtema', '')), ''), 'semsubtema'),
      preco = (p_produto->>'preco')::numeric,
      preco_compra = coalesce(nullif(trim(coalesce(p_produto->>'preco_compra', '')), '')::numeric, 0),
      peso = (p_produto->>'peso')::numeric,
      stock = (p_produto->>'stock')::integer,
      top = nullif(trim(coalesce(p_produto->>'top', '')), ''),
      arquivado = coalesce((p_produto->>'arquivado')::boolean, false),
      descontinuado = coalesce((p_produto->>'descontinuado')::boolean, false),
      observacoes = nullif(trim(coalesce(p_produto->>'observacoes', '')), ''),
      ativo = coalesce((p_produto->>'ativo')::boolean, true),
      novidade = coalesce((p_produto->>'novidade')::boolean, false),
      imagens = v_imagens,
      fornecedores = coalesce(p_produto->'fornecedores', produto.fornecedores, '{}'::jsonb)
    where upper(produto.sku) = upper(trim(coalesce(p_sku_original, '')))
    returning produto.*
    into v_produto;
  end if;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  return jsonb_build_object(
    'id', v_produto.id,
    'referencia', v_produto.referencia,
    'lego', coalesce(v_produto.lego, ''),
    'sku', v_produto.sku,
    'nome', v_produto.nome,
    'preco', coalesce(v_produto.preco, 0),
    'preco_compra', coalesce(v_produto.preco_compra, 0),
    'top', coalesce(v_produto.top, ''),
    'arquivado', coalesce(v_produto.arquivado, false),
    'descontinuado', coalesce(v_produto.descontinuado, false),
    'novidade', coalesce(v_produto.novidade, false),
    'peso', coalesce(v_produto.peso, 10),
    'tema', coalesce(v_produto.tema, ''),
    'subtema', coalesce(v_produto.subtema, ''),
    'stock', coalesce(v_produto.stock, 0),
    'ativo', coalesce(v_produto.ativo, true),
    'observacoes', coalesce(v_produto.observacoes, ''),
    'imagens', coalesce(to_jsonb(v_produto.imagens), '[]'::jsonb),
    'fornecedores', coalesce(v_produto.fornecedores, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.editar_produto_mapa_admin(text, text, jsonb)
from public, anon;
grant execute on function public.editar_produto_mapa_admin(text, text, jsonb)
to authenticated;
