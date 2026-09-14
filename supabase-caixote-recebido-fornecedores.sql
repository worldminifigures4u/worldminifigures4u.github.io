-- Figures Planet - estado "Caixote recebido" nas encomendas a fornecedores.
-- Executar no Supabase SQL Editor.

alter table public.encomendas_fornecedores
    drop constraint if exists encomendas_fornecedores_estado_check;

alter table public.encomendas_fornecedores
    add constraint encomendas_fornecedores_estado_check
    check (estado in (
        'A preparar',
        'Encomendada',
        'Caixote recebido',
        'Recebida parcialmente',
        'Recebida',
        'Cancelada'
    ));
