-- Já aplicado no Supabase em 2026-10-28 (migration encomendas_stock_verificado).
-- Encomenda: caixa "Stock verificado" (Penúltimo/Último revistos antes de enviar).
alter table public.encomendas add column if not exists stock_verificado_em timestamptz;
comment on column public.encomendas.stock_verificado_em is 'Quando o admin confirmou o Penúltimo/Último e o stock desta encomenda (null = por verificar).';
