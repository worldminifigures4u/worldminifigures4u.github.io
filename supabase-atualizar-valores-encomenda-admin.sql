create or replace function public.atualizar_valores_encomenda_admin(
  p_encomenda_id text,
  p_portes numeric,
  p_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portes numeric;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if p_portes is null or p_portes < 0 then
    raise exception 'Portes invalidos';
  end if;

  if p_total is null or p_total < 0 then
    raise exception 'Total invalido';
  end if;

  v_portes := round(p_portes, 2);
  v_total := round(p_total, 2);

  update public.encomendas
  set
    portes = v_portes,
    total = v_total
  where id::text = p_encomenda_id;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'portes', v_portes,
    'total', v_total
  );
end;
$$;

revoke execute on function public.atualizar_valores_encomenda_admin(text, numeric, numeric)
from public, anon;

grant execute on function public.atualizar_valores_encomenda_admin(text, numeric, numeric)
to authenticated;
