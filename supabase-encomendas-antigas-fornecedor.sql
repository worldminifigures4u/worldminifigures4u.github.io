-- Figures Planet — encomendas antigas a fornecedores (só histórico de preços).
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
--
-- Uma encomenda antiga fica "Recebida", com tudo dado como recebido, sem mexer no stock
-- nem nas marcações das figuras. Serve só para registar preços de compra e histórico.

alter table public.encomendas_fornecedores
    add column if not exists historico boolean not null default false;

-- Cria a encomenda antiga (vazia) já como Recebida, com a data indicada.
create or replace function public.criar_encomenda_antiga_fornecedor_admin(
    p_fornecedor text,
    p_codigo text,
    p_data timestamptz
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
    if nullif(trim(coalesce(p_fornecedor, '')), '') is null then
        raise exception 'Indica o fornecedor.';
    end if;
    if p_data is null then
        raise exception 'Indica a data da encomenda.';
    end if;

    insert into public.encomendas_fornecedores (
        codigo, fornecedor, referencia, estado, itens, criado_por,
        data_encomendada, data_caixote_recebido, historico
    )
    values (
        coalesce(nullif(trim(coalesce(p_codigo, '')), ''), public.gerar_codigo_encomenda_fornecedor()),
        trim(p_fornecedor),
        null,
        'Recebida',
        '[]'::jsonb,
        auth.uid(),
        p_data,
        p_data,
        true
    )
    returning * into nova;

    return to_jsonb(nova);
end;
$$;

-- Numa encomenda antiga, dá todas as unidades como recebidas (não mexe no stock).
create or replace function public.acertar_recebido_encomenda_antiga_fornecedor_admin(
    p_id text
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

    update public.encomendas_fornecedores
    set itens = (
        select coalesce(jsonb_agg(
            jsonb_set(item.value, '{recebido}', to_jsonb(greatest(0, coalesce((item.value ->> 'quantidade')::int, 0))), true)
            order by item.ordem
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(itens, '[]'::jsonb)) with ordinality as item(value, ordem)
    )
    where id::text = p_id
      and historico = true
    returning * into atualizada;

    if atualizada.id is null then
        raise exception 'Encomenda antiga nao encontrada.';
    end if;

    return to_jsonb(atualizada);
end;
$$;

revoke execute on function public.criar_encomenda_antiga_fornecedor_admin(text, text, timestamptz) from public, anon;
grant execute on function public.criar_encomenda_antiga_fornecedor_admin(text, text, timestamptz) to authenticated;
revoke execute on function public.acertar_recebido_encomenda_antiga_fornecedor_admin(text) from public, anon;
grant execute on function public.acertar_recebido_encomenda_antiga_fornecedor_admin(text) to authenticated;
