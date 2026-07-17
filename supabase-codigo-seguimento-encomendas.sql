-- Código de seguimento CTT nas encomendas de clientes.
-- Executar no SQL Editor do Supabase (uma vez).

alter table public.encomendas
  add column if not exists codigo_seguimento text;

comment on column public.encomendas.codigo_seguimento is
  'Número de seguimento do envio (ex.: CTT Registado).';
