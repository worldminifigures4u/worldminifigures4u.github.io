-- Figures Planet — encomendas a fornecedores sem código automático
-- Executar no Supabase SQL Editor (uma vez).
-- Depois de criar a encomenda, o código fica vazio ("Sem código") até editares.

alter table public.encomendas_fornecedores
    alter column codigo drop not null;

create or replace function public.criar_encomenda_fornecedor_admin(
    p_fornecedor text,
    p_referencia text,
    p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    nova public.encomendas_fornecedores;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    if coalesce(jsonb_array_length(p_itens), 0) = 0 then
        raise exception 'A encomenda precisa de produtos.';
    end if;

    insert into public.encomendas_fornecedores (codigo, fornecedor, referencia, estado, itens, criado_por)
    values (
        null,
        nullif(trim(p_fornecedor), ''),
        nullif(trim(coalesce(p_referencia, '')), ''),
        'A preparar',
        p_itens,
        auth.uid()
    )
    returning * into nova;

    return to_jsonb(nova);
end;
$$;

revoke execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb)
    from public, anon;
grant execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb)
    to authenticated;
