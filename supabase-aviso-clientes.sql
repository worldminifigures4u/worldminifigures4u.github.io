-- Executar no SQL Editor do Supabase.
-- Adiciona o aviso interno nas fichas de clientes.

alter table public.clientes_gestao
  add column if not exists tem_aviso boolean not null default false;

create or replace function public.guardar_aviso_cliente_admin(p_cliente_id uuid, p_tem_aviso boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  update public.clientes_gestao
  set tem_aviso = coalesce(p_tem_aviso, false), updated_at = now()
  where id = p_cliente_id;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.guardar_aviso_cliente_admin(uuid, boolean) from public, anon;
grant execute on function public.guardar_aviso_cliente_admin(uuid, boolean) to authenticated;
