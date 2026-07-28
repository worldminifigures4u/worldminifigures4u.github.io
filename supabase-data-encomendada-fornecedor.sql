-- Figures Planet — data_encomendada nas encomendas a fornecedores
-- Corrige a data mostrada: fica a data em que o estado passa a «Encomendada»,
-- e deixa de mudar quando se edita o código / outros campos (atualizado_em).
-- Correr uma vez no SQL Editor do Supabase.

alter table public.encomendas_fornecedores
    add column if not exists data_encomendada timestamptz;

-- Pedidos já Em «Encomendada» sem data: usar criado_em (não atualizado_em — pode ser edição)
update public.encomendas_fornecedores
set data_encomendada = criado_em
where data_encomendada is null
  and lower(trim(coalesce(estado, ''))) = 'encomendada';

create or replace function public.alterar_estado_encomenda_fornecedor_admin(
    p_id text,
    p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    atualizada public.encomendas_fornecedores;
    v_estado_anterior text;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    select estado into v_estado_anterior
    from public.encomendas_fornecedores
    where id::text = p_id
    for update;

    if not found then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    update public.encomendas_fornecedores
    set
        estado = p_estado,
        data_encomendada = case
            when lower(trim(coalesce(p_estado, ''))) = 'encomendada'
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
    v_itens jsonb := case when p_dados ? 'itens' then p_dados -> 'itens' else null end;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    if v_itens is not null and coalesce(jsonb_typeof(v_itens), '') <> 'array' then
        raise exception 'Itens invalidos para a encomenda.';
    end if;

    select estado into v_estado_anterior
    from public.encomendas_fornecedores
    where id::text = p_id
    for update;

    if not found then
        raise exception 'Encomenda de fornecedor nao encontrada.';
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

revoke execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) from public, anon;
revoke execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) from public, anon;
grant execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) to authenticated;
grant execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) to authenticated;
