-- Executar no SQL Editor do Supabase.
-- Protege o apagamento de encomendas para nao perder stock:
-- - so apaga encomendas canceladas
-- - exige stock_reposto = true

create or replace function public.apagar_encomenda_admin(
  p_encomenda_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_estado text;
  v_stock_reposto boolean;
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select codigo_encomenda, estado, coalesce(stock_reposto, false)
  into v_codigo, v_estado, v_stock_reposto
  from public.encomendas
  where id::text = p_encomenda_id
  for update
  limit 1;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;

  if lower(coalesce(v_estado, '')) <> 'cancelado' then
    raise exception 'Cancele a encomenda antes de apagar, para garantir a reposicao do stock.';
  end if;

  if not coalesce(v_stock_reposto, false) then
    raise exception 'Nao e possivel apagar: o stock desta encomenda ainda nao esta marcado como reposto.';
  end if;

  delete from public.encomendas
  where id::text = p_encomenda_id;

  return jsonb_build_object(
    'sucesso', true,
    'codigo', v_codigo
  );
end;
$$;

revoke execute on function public.apagar_encomenda_admin(text)
from public, anon;

grant execute on function public.apagar_encomenda_admin(text)
to authenticated;
