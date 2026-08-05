-- Importação administrativa protegida. Evita conceder SELECT público ao stock.
alter table public.produtos add column if not exists referencia text;
alter table public.produtos add column if not exists top text;
alter table public.produtos add column if not exists descontinuado boolean not null default false;
alter table public.produtos add column if not exists novidade boolean not null default false;
alter table public.produtos add column if not exists fornecedores jsonb not null default '{}'::jsonb;

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
    raise exception 'Lista de produtos inválida.';
  end if;

  for v_produto in select value from jsonb_array_elements(p_produtos)
  loop
    insert into public.produtos (
      sku,
      referencia,
      nome,
      preco,
      top,
      descontinuado,
      novidade,
      stock,
      tema,
      subtema,
      peso,
      fornecedores,
      ativo
    ) values (
      upper(trim(v_produto->>'sku')),
      nullif(trim(v_produto->>'referencia'), ''),
      trim(v_produto->>'nome'),
      (v_produto->>'preco')::numeric,
      nullif(trim(v_produto->>'top'), ''),
      coalesce((v_produto->>'descontinuado')::boolean, false),
      case
        when lower(trim(coalesce(v_produto->>'novidade', ''))) in ('1', 'true', 't', 'yes', 'y', 'sim', 's', 'x', 'verdadeiro') then true
        else false
      end,
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
      novidade = excluded.novidade,
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

create or replace function public.remover_produtos_admin(p_skus text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removidos integer := 0;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <>
     'worldminifigures4u@gmail.com' then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  delete from public.produtos
  where sku = any(p_skus);

  get diagnostics v_removidos = row_count;
  return jsonb_build_object('removidos', v_removidos);
end;
$$;

revoke execute on function public.importar_produtos_admin(jsonb)
from public, anon;

revoke execute on function public.remover_produtos_admin(text[])
from public, anon;

grant execute on function public.importar_produtos_admin(jsonb)
to authenticated;

grant execute on function public.remover_produtos_admin(text[])
to authenticated;

-- A vista publica da loja nao expoe stock, referencia nem fornecedores.
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
  coalesce(produto.descontinuado, false) as descontinuado
from public.produtos as produto;

grant select on public.produtos_loja to anon, authenticated;
