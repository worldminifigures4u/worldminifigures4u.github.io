-- Figures Planet: data em que o caixote do fornecedor chega ("Caixote recebido").
-- Serve para contar os dias desde "Encomendada" até à chegada do caixote.
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.

alter table public.encomendas_fornecedores
    add column if not exists data_caixote_recebido timestamptz;

-- Preenche sozinho quando o estado passa a "Caixote recebido" (ou salta logo para Recebida).
create or replace function public.fp_data_caixote_recebido_fornecedor()
returns trigger
language plpgsql
as $$
begin
    if new.data_caixote_recebido is null
       and lower(trim(coalesce(new.estado, ''))) in ('caixote recebido', 'recebida parcialmente', 'recebida')
       and lower(trim(coalesce(old.estado, ''))) is distinct from lower(trim(coalesce(new.estado, ''))) then
        new.data_caixote_recebido := now();
    end if;
    -- Voltar a "A preparar" ou "Encomendada" limpa a data (o caixote ainda não chegou).
    if lower(trim(coalesce(new.estado, ''))) in ('a preparar', 'encomendada') then
        new.data_caixote_recebido := null;
    end if;
    return new;
end;
$$;

drop trigger if exists fp_data_caixote_recebido_fornecedor on public.encomendas_fornecedores;
create trigger fp_data_caixote_recebido_fornecedor
    before update of estado on public.encomendas_fornecedores
    for each row
    execute function public.fp_data_caixote_recebido_fornecedor();

-- Encomendas antigas que já passaram do caixote: usa a data da última alteração como aproximação.
update public.encomendas_fornecedores
set data_caixote_recebido = coalesce(atualizado_em, criado_em)
where data_caixote_recebido is null
  and lower(trim(coalesce(estado, ''))) in ('caixote recebido', 'recebida parcialmente', 'recebida');
