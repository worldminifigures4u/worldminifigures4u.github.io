-- Figures Planet: guardar na encomenda do fornecedor os valores do "Preço de compra"
-- (Envio USD, Total compra USD, Total pago €, distribuir envio), para não ter de os
-- voltar a procurar quando se edita e grava a encomenda outra vez.
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.

alter table public.encomendas_fornecedores
    add column if not exists custos jsonb;

create or replace function public.guardar_custos_encomenda_fornecedor_admin(
    p_id text,
    p_custos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_custos jsonb;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    if p_custos is null or jsonb_typeof(p_custos) <> 'object' then
        v_custos := null;
    else
        v_custos := jsonb_strip_nulls(jsonb_build_object(
            'envio_usd', nullif(p_custos ->> 'envio_usd', '')::numeric,
            'total_compra_usd', nullif(p_custos ->> 'total_compra_usd', '')::numeric,
            'total_pago_eur', nullif(p_custos ->> 'total_pago_eur', '')::numeric,
            'rateio_envio', case when p_custos ->> 'rateio_envio' = 'valor' then 'valor' else 'unidades' end
        ));
    end if;

    update public.encomendas_fornecedores
    set custos = v_custos
    where id::text = p_id;

    if not found then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    return coalesce(v_custos, '{}'::jsonb);
end;
$$;

revoke execute on function public.guardar_custos_encomenda_fornecedor_admin(text, jsonb) from public, anon;
grant execute on function public.guardar_custos_encomenda_fornecedor_admin(text, jsonb) to authenticated;
