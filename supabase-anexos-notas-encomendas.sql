-- Executar uma vez no SQL Editor do Supabase.
-- Cria notas internas nas encomendas e um bucket privado para anexos.

alter table public.encomendas
add column if not exists notas_internas text;

create or replace function public.guardar_notas_encomenda_admin(
  p_encomenda_id text,
  p_notas text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <>
     'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  update public.encomendas
  set notas_internas = left(coalesce(p_notas, ''), 10000)
  where id::text = p_encomenda_id;

  if not found then
    raise exception 'Encomenda nao encontrada';
  end if;

  return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.guardar_notas_encomenda_admin(text, text)
from public, anon;

grant execute on function public.guardar_notas_encomenda_admin(text, text)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'anexos-encomendas',
  'anexos-encomendas',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin pode consultar anexos de encomendas" on storage.objects;
create policy "Admin pode consultar anexos de encomendas"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'anexos-encomendas'
  and public.is_admin()
);

drop policy if exists "Admin pode adicionar anexos de encomendas" on storage.objects;
create policy "Admin pode adicionar anexos de encomendas"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'anexos-encomendas'
  and public.is_admin()
);

drop policy if exists "Admin pode apagar anexos de encomendas" on storage.objects;
create policy "Admin pode apagar anexos de encomendas"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'anexos-encomendas'
  and public.is_admin()
);

