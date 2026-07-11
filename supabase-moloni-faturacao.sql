-- Executar no SQL Editor do Supabase.
-- Regista faturas-recibo Moloni emitidas automaticamente para encomendas pagas.

alter table public.encomendas
  add column if not exists moloni_document_id bigint,
  add column if not exists moloni_fatura_numero text,
  add column if not exists moloni_fatura_emitida_em timestamptz,
  add column if not exists moloni_fatura_erro text;

comment on column public.encomendas.moloni_document_id is 'ID do documento criado no Moloni ON.';
comment on column public.encomendas.moloni_fatura_numero is 'Numero sequencial da fatura no Moloni, quando fechada.';
comment on column public.encomendas.moloni_fatura_emitida_em is 'Data/hora da emissao automatica no Moloni.';
comment on column public.encomendas.moloni_fatura_erro is 'Ultimo erro ao emitir fatura no Moloni.';
