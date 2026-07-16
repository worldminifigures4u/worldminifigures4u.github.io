-- Executar no SQL Editor do Supabase.
-- Regista faturas-recibo Moloni emitidas automaticamente para encomendas pagas.
-- data_pagamento: data real do pagamento (usada na fatura-recibo ao concluir).

alter table public.encomendas
  add column if not exists moloni_document_id bigint,
  add column if not exists moloni_fatura_numero text,
  add column if not exists moloni_fatura_emitida_em timestamptz,
  add column if not exists moloni_fatura_erro text,
  add column if not exists data_pagamento timestamptz;

comment on column public.encomendas.moloni_document_id is 'ID do documento criado no Moloni ON.';
comment on column public.encomendas.moloni_fatura_numero is 'Numero sequencial da fatura no Moloni, quando fechada.';
comment on column public.encomendas.moloni_fatura_emitida_em is 'Data/hora da emissao automatica no Moloni.';
comment on column public.encomendas.moloni_fatura_erro is 'Ultimo erro ao emitir fatura no Moloni.';
comment on column public.encomendas.data_pagamento is 'Data/hora do pagamento (estado Pago). Usada na fatura-recibo Moloni ao concluir.';

-- Encomendas já pagas sem data_pagamento: usar created_at como aproximação
-- (antes created_at era sobrescrito na marcação como Pago).
update public.encomendas
set data_pagamento = created_at
where data_pagamento is null
  and lower(trim(estado)) in ('pago', 'em preparacao', 'em preparação', 'enviado', 'concluido', 'concluído');
