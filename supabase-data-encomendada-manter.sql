-- Figures Planet — a data da encomenda a fornecedor deixa de ser apagada por engano.
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
--
-- 1) Se a encomenda já tem data_encomendada, mudar o estado (ex.: Encomendada -> A preparar -> Encomendada)
--    já não a substitui pela data de hoje.
-- 2) Nova função para o administrador corrigir a data à mão (campo "Data da encomenda" no Editar).

create or replace function public.fp_manter_data_encomendada_fornecedor()
returns trigger
language plpgsql
as $$
begin
    if old.data_encomendada is not null
       and new.data_encomendada is distinct from old.data_encomendada
       and coalesce(current_setting('fp.data_encomendada_manual', true), '') <> '1' then
        new.data_encomendada := old.data_encomendada;
    end if;
    return new;
end;
$$;

drop trigger if exists fp_manter_data_encomendada_fornecedor on public.encomendas_fornecedores;
create trigger fp_manter_data_encomendada_fornecedor
    before update on public.encomendas_fornecedores
    for each row
    execute function public.fp_manter_data_encomendada_fornecedor();

create or replace function public.definir_data_encomendada_fornecedor_admin(
    p_id text,
    p_data timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    atualizada public.encomendas_fornecedores;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;
    if p_data is null then
        raise exception 'Data da encomenda em falta.';
    end if;

    perform set_config('fp.data_encomendada_manual', '1', true);

    update public.encomendas_fornecedores
    set data_encomendada = p_data
    where id::text = p_id
    returning * into atualizada;

    perform set_config('fp.data_encomendada_manual', '', true);

    if atualizada.id is null then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    return to_jsonb(atualizada);
end;
$$;

grant execute on function public.definir_data_encomendada_fornecedor_admin(text, timestamptz) to authenticated;
