-- Executar no SQL Editor do Supabase.
-- Ao editar pedido de fornecedor, nao permitir baixar "recebido":
-- isso reabria pendente e permitia re-receber stock ja somado ao catalogo.

create or replace function public.atualizar_encomenda_fornecedor_admin(
    p_id text,
    p_dados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    atualizada public.encomendas_fornecedores;
    v_estado_anterior text;
    v_itens_atuais jsonb;
    v_itens jsonb := case when p_dados ? 'itens' then p_dados -> 'itens' else null end;
    v_itens_seguros jsonb := '[]'::jsonb;
    v_item jsonb;
    v_produto_id text;
    v_quantidade int;
    v_recebido_db int;
    v_recebido int;
    v_codigo text := case
        when p_dados ? 'codigo' then nullif(trim(coalesce(p_dados ->> 'codigo', '')), '')
        else null
    end;
    v_fornecedor text := nullif(trim(p_dados ->> 'fornecedor'), '');
    v_referencia text := case
        when p_dados ? 'referencia' then nullif(trim(coalesce(p_dados ->> 'referencia', '')), '')
        else null
    end;
    v_estado text := nullif(trim(p_dados ->> 'estado'), '');
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    if v_itens is not null and coalesce(jsonb_typeof(v_itens), '') <> 'array' then
        raise exception 'Itens invalidos para a encomenda.';
    end if;

    select estado, coalesce(itens, '[]'::jsonb)
    into v_estado_anterior, v_itens_atuais
    from public.encomendas_fornecedores
    where id::text = p_id
    for update;

    if not found then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    if v_itens is not null then
        for v_item in select value from jsonb_array_elements(v_itens) loop
            v_produto_id := coalesce(nullif(v_item ->> 'id', ''), nullif(v_item ->> 'produto_id', ''));
            v_quantidade := greatest(0, coalesce((v_item ->> 'quantidade')::int, 0));

            select greatest(0, coalesce((antigo.value ->> 'recebido')::int, 0))
            into v_recebido_db
            from jsonb_array_elements(v_itens_atuais) as antigo(value)
            where coalesce(nullif(antigo.value ->> 'id', ''), nullif(antigo.value ->> 'produto_id', '')) = v_produto_id
            limit 1;

            if not found then
                v_recebido_db := 0;
            end if;

            -- recebido so muda via receber_stock_fornecedor_admin (ignora valor do cliente).
            v_recebido := v_recebido_db;
            -- Quantidade pedida nao pode ficar abaixo do ja recebido.
            v_quantidade := greatest(v_quantidade, v_recebido);

            v_itens_seguros := v_itens_seguros || jsonb_build_array(
                jsonb_set(
                    jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade), true),
                    '{recebido}',
                    to_jsonb(v_recebido),
                    true
                )
            );
        end loop;
        v_itens := v_itens_seguros;
    end if;

    update public.encomendas_fornecedores
    set
        codigo = case when p_dados ? 'codigo' then v_codigo else codigo end,
        fornecedor = coalesce(v_fornecedor, fornecedor),
        referencia = case when p_dados ? 'referencia' then v_referencia else referencia end,
        estado = coalesce(v_estado, estado),
        itens = coalesce(v_itens, itens),
        data_encomendada = case
            when lower(trim(coalesce(coalesce(v_estado, v_estado_anterior), ''))) = 'encomendada'
                 and lower(trim(coalesce(v_estado_anterior, ''))) is distinct from 'encomendada'
            then now()
            else data_encomendada
        end
    where id::text = p_id
    returning * into atualizada;

    if atualizada.id is null then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    return to_jsonb(atualizada);
end;
$$;

revoke execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) from public, anon;
grant execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) to authenticated;
