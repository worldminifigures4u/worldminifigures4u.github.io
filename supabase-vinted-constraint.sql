-- Permitir plataforma Vinted em clientes_perfis_externos.
-- Executar no SQL Editor do Supabase.

alter table public.clientes_perfis_externos
  drop constraint if exists clientes_perfis_externos_plataforma_check;

alter table public.clientes_perfis_externos
  add constraint clientes_perfis_externos_plataforma_check
  check (plataforma in ('Wallapop', 'Vinted', 'OLX', 'Todocoleccion'));
