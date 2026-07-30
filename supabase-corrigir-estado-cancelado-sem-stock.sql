-- Executar no SQL Editor do Supabase.
-- Impede marcar Cancelado via atualizar_estado (sem repor stock).
-- Cancelamento deve usar cancelar_encomenda_plataforma_admin.

create or replace function public.atualizar_estado_encomenda_admin(
  p_encomenda_id text,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if p_estado not in (
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído'
  ) then
    if lower(coalesce(p_estado, '')) = 'cancelado' then
      raise exception 'Use cancelar_encomenda_plataforma_admin para cancelar e repor o stock';
    end if;
    raise exception 'Estado inválido';
  end if;

  update public.encomendas
  set estado = p_estado
  where id::text = p_encomenda_id;

  if not found then
    raise exception 'Encomenda não encontrada';
  end if;

  return jsonb_build_object('sucesso', true, 'estado', p_estado);
end;
$$;

revoke execute on function public.atualizar_estado_encomenda_admin(text, text)
from public, anon;

grant execute on function public.atualizar_estado_encomenda_admin(text, text)
to authenticated;
