-- Encomendas admin: devolver tambem as observacoes da ficha da figura.
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
    jsonb_agg(
      jsonb_build_object(
        'id', produto.id::text,
        'referencia', produto.referencia,
        'sku', produto.sku,
        'imagens', produto.imagens,
        'tema', produto.tema,
        'subtema', produto.subtema,
        'observacoes', coalesce(produto.observacoes, '')
      )
      order by produto.id
    ),
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
