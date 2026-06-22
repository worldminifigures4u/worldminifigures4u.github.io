-- Adiciona a referencia interna dos produtos sem a expor no catalogo publico.
alter table public.produtos
  add column if not exists referencia text;

alter table public.produtos
  add column if not exists top text;

alter table public.produtos
  add column if not exists descontinuado boolean not null default false;

alter table public.produtos
  add column if not exists fornecedores jsonb not null default '{}'::jsonb;

create or replace function public.importar_produtos_admin(p_produtos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto jsonb;
  v_importados integer := 0;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <>
     'worldminifigures4u@gmail.com' then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_produtos) <> 'array' then
    raise exception 'Lista de produtos invalida.';
  end if;

  for v_produto in select value from jsonb_array_elements(p_produtos)
  loop
    insert into public.produtos (
      sku, referencia, nome, preco, top, descontinuado, stock, tema, subtema, peso, fornecedores, ativo
    ) values (
      upper(trim(v_produto->>'sku')),
      nullif(trim(v_produto->>'referencia'), ''),
      trim(v_produto->>'nome'),
      (v_produto->>'preco')::numeric,
      nullif(trim(v_produto->>'top'), ''),
      coalesce((v_produto->>'descontinuado')::boolean, false),
      (v_produto->>'stock')::integer,
      trim(v_produto->>'tema'),
      coalesce(nullif(trim(v_produto->>'subtema'), ''), 'semsubtema'),
      (v_produto->>'peso')::numeric,
      coalesce(v_produto->'fornecedores', '{}'::jsonb),
      coalesce((v_produto->>'ativo')::boolean, false)
    )
    on conflict (sku) do update set
      referencia = excluded.referencia,
      nome = excluded.nome,
      preco = excluded.preco,
      top = excluded.top,
      descontinuado = excluded.descontinuado,
      stock = excluded.stock,
      tema = excluded.tema,
      subtema = excluded.subtema,
      peso = excluded.peso,
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
      'descontinuado', coalesce(produto.descontinuado, false),
      'peso', coalesce(produto.peso, 10),
      'tema', coalesce(produto.tema, ''),
      'subtema', coalesce(produto.subtema, ''),
      'imagens', produto.imagens,
      'stock', coalesce(produto.stock, 0),
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
  if lower(coalesce(auth.jwt() ->> 'email', '')) <>
     'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', produto.id::text,
      'referencia', produto.referencia,
      'sku', produto.sku,
      'imagens', produto.imagens
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
create or replace view public.produtos_loja as
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
  coalesce(produto.descontinuado, false) as descontinuado
from public.produtos as produto;

grant select on public.produtos_loja to anon, authenticated;
