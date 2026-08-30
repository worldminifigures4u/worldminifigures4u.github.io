-- Importação de catálogo que preserva stock dos produtos existentes.
-- Ativo fica automático: stock > 0 → ativo; stock = 0 → inativo.
-- Correr no Supabase SQL Editor.

alter table public.produtos
    add column if not exists unidades_por_embalagem integer not null default 1;

alter table public.produtos
    drop constraint if exists produtos_unidades_por_embalagem_check;

alter table public.produtos
    add constraint produtos_unidades_por_embalagem_check
    check (unidades_por_embalagem >= 1);

create or replace function public.importar_produtos_sem_stock_admin(p_produtos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto jsonb;
  v_imagens json[];
  v_importados integer := 0;
  v_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_produtos) <> 'array' then
    raise exception 'Lista de produtos invalida.';
  end if;

  for v_produto in select value from jsonb_array_elements(p_produtos)
  loop
    v_stock := greatest(coalesce((v_produto->>'stock')::integer, 0), 0);
    select coalesce(array_agg(to_json(trim(valor))), array[]::json[])
    into v_imagens
    from jsonb_array_elements_text(coalesce(v_produto->'imagens', '[]'::jsonb)) as imagens(valor)
    where trim(valor) <> '';

    insert into public.produtos (
      sku,
      referencia,
      lego,
      nome,
      preco,
      preco_compra,
      top,
      arquivado,
      descontinuado,
      novidade,
      stock,
      tema,
      subtema,
      peso,
      unidades_por_embalagem,
      observacoes,
      imagens,
      fornecedores,
      ativo
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
      v_stock,
      trim(v_produto->>'tema'),
      coalesce(nullif(trim(v_produto->>'subtema'), ''), 'semsubtema'),
      (v_produto->>'peso')::numeric,
      greatest(1, coalesce(nullif(trim(coalesce(v_produto->>'unidades_por_embalagem', '')), '')::integer, 1)),
      nullif(trim(coalesce(v_produto->>'observacoes', '')), ''),
      v_imagens,
      coalesce(v_produto->'fornecedores', '{}'::jsonb),
      v_stock > 0
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
      tema = excluded.tema,
      subtema = excluded.subtema,
      peso = excluded.peso,
      unidades_por_embalagem = excluded.unidades_por_embalagem,
      observacoes = excluded.observacoes,
      imagens = excluded.imagens,
      fornecedores = excluded.fornecedores,
      ativo = (public.produtos.stock > 0);

    v_importados := v_importados + 1;
  end loop;

  return jsonb_build_object('importados', v_importados);
end;
$$;

revoke execute on function public.importar_produtos_sem_stock_admin(jsonb)
from public, anon;

grant execute on function public.importar_produtos_sem_stock_admin(jsonb)
to authenticated;
