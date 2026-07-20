-- Executar no SQL Editor do Supabase.
-- Stock negativo (encomendas plataforma com aviso) + receber fornecedor:
-- - criar/atualizar encomenda já permitem stock negativo com permitir_stock_negativo
-- - receber soma ao stock atual (ex.: -1 + 5 = 4)
-- - ativa o produto quando o stock passa de <=0 para >0

create or replace function public.receber_stock_fornecedor_admin(
    p_encomenda_id text,
    p_recebidos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    encomenda public.encomendas_fornecedores;
    item jsonb;
    novos_itens jsonb := '[]'::jsonb;
    aplicado jsonb := '[]'::jsonb;
    produto_id_text text;
    qtd_pedida int;
    qtd_ja_recebida int;
    qtd_solicitada int;
    qtd_aplicar int;
    qtd_pendente int;
    novo_recebido int;
    algum_recebido boolean := false;
    tudo_recebido boolean := true;
    atualizada public.encomendas_fornecedores;
    v_stock_atual int;
    v_stock_novo int;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    select * into encomenda
    from public.encomendas_fornecedores
    where id::text = p_encomenda_id
    for update;

    if encomenda.id is null then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    for item in select value from jsonb_array_elements(coalesce(encomenda.itens, '[]'::jsonb)) loop
        produto_id_text := item ->> 'id';
        qtd_pedida := greatest(0, coalesce((item ->> 'quantidade')::int, 0));
        qtd_ja_recebida := greatest(0, coalesce((item ->> 'recebido')::int, 0));
        qtd_pendente := greatest(0, qtd_pedida - qtd_ja_recebida);

        select coalesce(sum(greatest(0, coalesce((r.value ->> 'quantidade')::int, 0))), 0)
        into qtd_solicitada
        from jsonb_array_elements(coalesce(p_recebidos, '[]'::jsonb)) as r(value)
        where coalesce(r.value ->> 'produto_id', r.value ->> 'id') = produto_id_text;

        qtd_aplicar := least(qtd_solicitada, qtd_pendente);

        if produto_id_text is not null and qtd_aplicar > 0 then
            select coalesce(stock, 0)
            into v_stock_atual
            from public.produtos
            where id::text = produto_id_text
            for update;

            if not found then
                raise exception 'Produto % nao encontrado no catalogo.', produto_id_text;
            end if;

            v_stock_novo := v_stock_atual + qtd_aplicar;

            update public.produtos
            set
                novidade = case
                    when v_stock_atual <= 0 and v_stock_novo > 0 then false
                    else novidade
                end,
                stock = v_stock_novo,
                ativo = v_stock_novo > 0
            where id::text = produto_id_text;

            aplicado := aplicado || jsonb_build_array(jsonb_build_object(
                'produto_id', produto_id_text,
                'quantidade', qtd_aplicar,
                'solicitada', qtd_solicitada,
                'pendente_antes', qtd_pendente,
                'stock_antes', v_stock_atual,
                'stock_depois', v_stock_novo,
                'ativado', (v_stock_atual <= 0 and v_stock_novo > 0)
            ));
        end if;

        novo_recebido := qtd_ja_recebida + qtd_aplicar;
        if novo_recebido > 0 then
            algum_recebido := true;
        end if;
        if novo_recebido < qtd_pedida then
            tudo_recebido := false;
        end if;

        novos_itens := novos_itens || jsonb_set(item, '{recebido}', to_jsonb(novo_recebido), true);
    end loop;

    if jsonb_array_length(novos_itens) = 0 then
        tudo_recebido := false;
        algum_recebido := false;
    end if;

    update public.encomendas_fornecedores
    set itens = novos_itens,
        estado = case
            when tudo_recebido and jsonb_array_length(novos_itens) > 0 then 'Recebida'
            when algum_recebido then 'Recebida parcialmente'
            else estado
        end
    where id = encomenda.id
    returning * into atualizada;

    return jsonb_build_object(
        'sucesso', true,
        'encomenda', to_jsonb(atualizada),
        'recebido_aplicado', aplicado
    );
end;
$$;

revoke execute on function public.receber_stock_fornecedor_admin(text, jsonb) from public, anon;
grant execute on function public.receber_stock_fornecedor_admin(text, jsonb) to authenticated;
