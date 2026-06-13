-- Executar no SQL Editor do Supabase.
-- Permite apenas ao administrador consultar todas as encomendas e alterar o estado.

alter table public.encomendas enable row level security;

drop policy if exists "Administrador pode ler todas as encomendas" on public.encomendas;
create policy "Administrador pode ler todas as encomendas"
on public.encomendas
for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

grant select on public.encomendas to authenticated;

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
    'Concluído',
    'Cancelado'
  ) then
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
