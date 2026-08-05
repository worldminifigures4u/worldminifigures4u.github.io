-- Executar no SQL Editor do Supabase.
-- Permite apagar um metodo de envio e as respetivas tarifas.

create or replace function public.remover_portes_metodo_admin(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_tarifas integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  v_id := lower(trim(coalesce(p_id, '')));
  if v_id = '' or v_id !~ '^[a-z0-9_]+$' then
    raise exception 'ID invalido.';
  end if;

  if not exists (select 1 from public.portes_metodos where id = v_id) then
    raise exception 'Metodo nao encontrado: %', v_id;
  end if;

  delete from public.portes_tarifas where metodo_id = v_id;
  get diagnostics v_tarifas = row_count;

  delete from public.portes_metodos where id = v_id;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_id,
    'tarifas_removidas', v_tarifas
  );
end;
$$;

revoke execute on function public.remover_portes_metodo_admin(text) from public, anon;
grant execute on function public.remover_portes_metodo_admin(text) to authenticated;
