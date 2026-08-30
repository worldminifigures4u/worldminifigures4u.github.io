-- Adiciona a referencia interna dos produtos sem a expor no catalogo publico.
alter table public.produtos
  add column if not exists referencia text;

alter table public.produtos
  add column if not exists lego text;

alter table public.produtos
  add column if not exists top text;

alter table public.produtos
  add column if not exists descontinuado boolean not null default false;

alter table public.produtos
  add column if not exists novidade boolean not null default false;

alter table public.produtos
  add column if not exists arquivado boolean not null default false;

alter table public.produtos
  add column if not exists fornecedores jsonb not null default '{}'::jsonb;

alter table public.produtos
  add column if not exists observacoes text;

alter table public.produtos
  add column if not exists preco_compra numeric not null default 0;

alter table public.produtos
  add column if not exists unidades_por_embalagem integer not null default 1;

alter table public.produtos
  drop constraint if exists produtos_unidades_por_embalagem_check;

alter table public.produtos
  add constraint produtos_unidades_por_embalagem_check
  check (unidades_por_embalagem >= 1);

create or replace function public.importar_produtos_admin(p_produtos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto jsonb;
  v_imagens json[];
  v_importados integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_produtos) <> 'array' then
    raise exception 'Lista de produtos invalida.';
  end if;

  for v_produto in select value from jsonb_array_elements(p_produtos)
  loop
    select coalesce(array_agg(to_json(trim(valor))), array[]::json[])
    into v_imagens
    from jsonb_array_elements_text(coalesce(v_produto->'imagens', '[]'::jsonb)) as imagens(valor)
    where trim(valor) <> '';

    insert into public.produtos (
      sku, referencia, lego, nome, preco, preco_compra, top, arquivado, descontinuado, novidade, stock, tema, subtema, peso, unidades_por_embalagem, observacoes, imagens, fornecedores, ativo
    ) values (
      upper(trim(v_produto->>'sku')),
      nullif(trim(v_produto->>'referencia'), ''),
      nullif(trim(v_produto->>'lego'), ''),
      trim(v_produto->>'nome'),
      (v_produto->>'preco')::numeric,
      coalesce(nullif(trim(coalesce(v_produto->>'preco_compra', '')), '')::numeric, 0),
      nullif(trim(v_produto->>'top'), ''),
      coalesce((v_produto->>'arquivado')::boolean, false),
      coalesce((v_produto->>'descontinuado')::boolean, false),
      case
        when lower(trim(coalesce(v_produto->>'novidade', ''))) in ('1', 'true', 't', 'yes', 'y', 'sim', 's', 'x', 'verdadeiro') then true
        else false
      end,
      (v_produto->>'stock')::integer,
      trim(v_produto->>'tema'),
      coalesce(nullif(trim(v_produto->>'subtema'), ''), 'semsubtema'),
      (v_produto->>'peso')::numeric,
      greatest(1, coalesce(nullif(trim(coalesce(v_produto->>'unidades_por_embalagem', '')), '')::integer, 1)),
      nullif(trim(coalesce(v_produto->>'observacoes', '')), ''),
      v_imagens,
      coalesce(v_produto->'fornecedores', '{}'::jsonb),
      coalesce((v_produto->>'ativo')::boolean, false)
    )
    on conflict (sku) do update set
      referencia = excluded.referencia,
      lego = excluded.lego,
      nome = excluded.nome,
      preco = excluded.preco,
      preco_compra = excluded.preco_compra,
      top = excluded.top,
      arquivado = excluded.arquivado,
      descontinuado = excluded.descontinuado,
      novidade = excluded.novidade,
      stock = excluded.stock,
      tema = excluded.tema,
      subtema = excluded.subtema,
      peso = excluded.peso,
      unidades_por_embalagem = excluded.unidades_por_embalagem,
      observacoes = excluded.observacoes,
      imagens = excluded.imagens,
      fornecedores = excluded.fornecedores,
      ativo = excluded.ativo;

    v_importados := v_importados + 1;
  end loop;

  return jsonb_build_object('importados', v_importados);
end;
$$;

revoke execute on function public.importar_produtos_admin(jsonb)
from public, anon;
grant execute on function public.importar_produtos_admin(jsonb)
to authenticated;

create or replace function public.listar_produtos_plataforma_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
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
      'unidades_por_embalagem', coalesce(produto.unidades_por_embalagem, 1),
      'tema', coalesce(produto.tema, ''),
      'subtema', coalesce(produto.subtema, ''),
      'imagens', produto.imagens,
      'stock', coalesce(produto.stock, 0),
      'observacoes', coalesce(produto.observacoes, ''),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb),
      'ativo', coalesce(produto.ativo, true)
    ) order by produto.nome)
    from public.produtos as produto
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_produtos_plataforma_admin()
from public, anon;
grant execute on function public.listar_produtos_plataforma_admin()
to authenticated;

create or replace function public.criar_produto_admin(
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

  insert into public.produtos (
    sku, referencia, lego, nome, tema, subtema, preco, preco_compra, peso, stock,
    observacoes, ativo, novidade, imagens
  ) values (
    v_sku,
    nullif(trim(coalesce(p_produto->>'referencia', '')), ''),
    nullif(trim(coalesce(p_produto->>'lego', '')), ''),
    trim(coalesce(p_produto->>'nome', '')),
    trim(coalesce(p_produto->>'tema', '')),
    coalesce(nullif(trim(coalesce(p_produto->>'subtema', '')), ''), 'semsubtema'),
    (p_produto->>'preco')::numeric,
    coalesce(nullif(trim(coalesce(p_produto->>'preco_compra', '')), '')::numeric, 0),
    (p_produto->>'peso')::numeric,
    (p_produto->>'stock')::integer,
    nullif(trim(coalesce(p_produto->>'observacoes', '')), ''),
    coalesce((p_produto->>'ativo')::boolean, true),
    coalesce((p_produto->>'novidade')::boolean, true),
    v_imagens
  )
  returning *
  into v_produto;

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
    'observacoes', coalesce(v_produto.observacoes, ''),
    'imagens', coalesce(to_jsonb(v_produto.imagens), '[]'::jsonb),
    'stock', coalesce(v_produto.stock, 0),
    'fornecedores', coalesce(v_produto.fornecedores, '{}'::jsonb),
    'ativo', coalesce(v_produto.ativo, true)
  );
end;
$$;

revoke execute on function public.criar_produto_admin(jsonb)
from public, anon;
grant execute on function public.criar_produto_admin(jsonb)
to authenticated;

create or replace function public.atualizar_stock_produto_admin(
  p_sku text,
  p_stock integer,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sku text;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  update public.produtos as produto
  set
    stock = greatest(coalesce(p_stock, 0), 0),
    ativo = coalesce(p_ativo, true)
  where upper(produto.sku) = upper(trim(coalesce(p_sku, '')))
  returning produto.sku
  into v_sku;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  return jsonb_build_object('sku', v_sku);
end;
$$;

revoke execute on function public.atualizar_stock_produto_admin(text, integer, boolean)
from public, anon;
grant execute on function public.atualizar_stock_produto_admin(text, integer, boolean)
to authenticated;

create or replace function public.atualizar_fornecedores_produto_admin(
  p_id text,
  p_fornecedores jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  update public.produtos as produto
  set fornecedores = coalesce(p_fornecedores, '{}'::jsonb)
  where produto.id::text = trim(coalesce(p_id, ''))
  returning produto.id::text
  into v_id;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.atualizar_fornecedores_produto_admin(text, jsonb)
from public, anon;
grant execute on function public.atualizar_fornecedores_produto_admin(text, jsonb)
to authenticated;

create or replace function public.atualizar_preco_compra_produto_admin(
  p_id text,
  p_sku text,
  p_referencia text,
  p_preco_compra numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.produtos%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  update public.produtos as produto
  set preco_compra = greatest(coalesce(p_preco_compra, 0), 0)
  where (
    nullif(trim(coalesce(p_id, '')), '') is not null
    and produto.id::text = trim(p_id)
  ) or (
    nullif(trim(coalesce(p_sku, '')), '') is not null
    and upper(produto.sku) = upper(trim(p_sku))
  ) or (
    nullif(trim(coalesce(p_referencia, '')), '') is not null
    and upper(coalesce(produto.referencia, '')) = upper(trim(p_referencia))
  )
  returning produto.*
  into v_produto;

  if not found then
    raise exception 'Produto nao encontrado para atualizar preço compra.';
  end if;

  return jsonb_build_object(
    'id', v_produto.id,
    'referencia', v_produto.referencia,
    'sku', v_produto.sku,
    'preco_compra', coalesce(v_produto.preco_compra, 0)
  );
end;
$$;

revoke execute on function public.atualizar_preco_compra_produto_admin(text, text, text, numeric)
from public, anon;
grant execute on function public.atualizar_preco_compra_produto_admin(text, text, text, numeric)
to authenticated;

create or replace function public.editar_produto_admin_v2(
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
    'observacoes', coalesce(v_produto.observacoes, ''),
    'imagens', coalesce(to_jsonb(v_produto.imagens), '[]'::jsonb),
    'stock', coalesce(v_produto.stock, 0),
    'fornecedores', coalesce(v_produto.fornecedores, '{}'::jsonb),
    'ativo', coalesce(v_produto.ativo, true)
  );
end;
$$;

revoke execute on function public.editar_produto_admin_v2(text, text, jsonb)
from public, anon;
grant execute on function public.editar_produto_admin_v2(text, text, jsonb)
to authenticated;

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
      'unidades_por_embalagem', coalesce(produto.unidades_por_embalagem, 1),
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

create or replace function public.obter_imagens_produtos_encomendas_admin(
  p_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produtos jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', produto.id::text,
      'referencia', produto.referencia,
      'sku', produto.sku,
      'imagens', produto.imagens,
      'tema', produto.tema,
      'subtema', produto.subtema,
      'observacoes', coalesce(produto.observacoes, '')
    ) order by produto.id),
    '[]'::jsonb
  )
  into v_produtos
  from public.produtos as produto
  where produto.id::text = any(coalesce(p_ids, array[]::text[]));

  return v_produtos;
end;
$$;

revoke execute on function public.obter_imagens_produtos_encomendas_admin(text[])
from public, anon;
grant execute on function public.obter_imagens_produtos_encomendas_admin(text[])
to authenticated;

-- A vista publica da loja nao expoe stock, referencia nem fornecedores.
-- security_invoker=false: anon nao precisa de SELECT directo em produtos.
revoke all on table public.produtos from public, anon, authenticated;

create or replace view public.produtos_loja
with (security_invoker = false)
as
select
  produto.id,
  produto.sku,
  produto.nome,
  produto.preco,
  produto.peso,
  produto.tema,
  produto.subtema,
  produto.imagens,
  produto.ativo,
  coalesce(produto.descontinuado, false) as descontinuado,
  coalesce(produto.arquivado, false) as arquivado
from public.produtos as produto;

grant select on public.produtos_loja to anon, authenticated;
