create or replace function public.apagar_produto_admin(
  p_id text
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

  delete from public.produtos as produto
  where nullif(trim(coalesce(p_id, '')), '') is not null
    and produto.id::text = trim(p_id)
  returning produto.*
  into v_produto;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  return jsonb_build_object(
    'id', v_produto.id,
    'sku', v_produto.sku,
    'nome', v_produto.nome,
    'referencia', v_produto.referencia
  );
end;
$$;

revoke execute on function public.apagar_produto_admin(text)
from public, anon;
grant execute on function public.apagar_produto_admin(text)
to authenticated;
