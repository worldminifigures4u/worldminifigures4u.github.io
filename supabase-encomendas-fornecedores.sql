-- Figures Planet - encomendas a fornecedores
-- Executar no Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.produtos
    add column if not exists novidade boolean not null default false;

create table if not exists public.encomendas_fornecedores (
    id uuid primary key default gen_random_uuid(),
    codigo text unique,
    fornecedor text not null,
    referencia text,
    estado text not null default 'A preparar'
        check (estado in ('A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada')),
    itens jsonb not null default '[]'::jsonb,
    criado_por uuid default auth.uid(),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    data_encomendada timestamptz
);

create index if not exists idx_encomendas_fornecedores_estado
    on public.encomendas_fornecedores (estado);

create index if not exists idx_encomendas_fornecedores_criado_em
    on public.encomendas_fornecedores (criado_em desc);

alter table public.encomendas_fornecedores enable row level security;

drop policy if exists "Admin pode ler encomendas fornecedores" on public.encomendas_fornecedores;
drop policy if exists "Admin pode criar encomendas fornecedores" on public.encomendas_fornecedores;
drop policy if exists "Admin pode atualizar encomendas fornecedores" on public.encomendas_fornecedores;
drop policy if exists "Admin pode apagar encomendas fornecedores" on public.encomendas_fornecedores;

create policy "Admin pode ler encomendas fornecedores"
on public.encomendas_fornecedores
for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode criar encomendas fornecedores"
on public.encomendas_fornecedores
for insert
to authenticated
with check ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode atualizar encomendas fornecedores"
on public.encomendas_fornecedores
for update
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode apagar encomendas fornecedores"
on public.encomendas_fornecedores
for delete
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

grant select, insert, update, delete on public.encomendas_fornecedores to authenticated;

create table if not exists public.fornecedores_admin (
    id text primary key,
    nome text not null unique,
    contacto text,
    notas text,
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

alter table public.fornecedores_admin enable row level security;

drop policy if exists "Admin pode ler fornecedores" on public.fornecedores_admin;
drop policy if exists "Admin pode criar fornecedores" on public.fornecedores_admin;
drop policy if exists "Admin pode atualizar fornecedores" on public.fornecedores_admin;
drop policy if exists "Admin pode apagar fornecedores" on public.fornecedores_admin;

create policy "Admin pode ler fornecedores"
on public.fornecedores_admin
for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode criar fornecedores"
on public.fornecedores_admin
for insert
to authenticated
with check ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode atualizar fornecedores"
on public.fornecedores_admin
for update
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

create policy "Admin pode apagar fornecedores"
on public.fornecedores_admin
for delete
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

grant select, insert, update, delete on public.fornecedores_admin to authenticated;

create or replace function public.fornecedores_admin_atualizado_em()
returns trigger
language plpgsql
as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;

drop trigger if exists trg_fornecedores_admin_atualizado_em on public.fornecedores_admin;

create trigger trg_fornecedores_admin_atualizado_em
before update on public.fornecedores_admin
for each row
execute function public.fornecedores_admin_atualizado_em();

create or replace function public.encomendas_fornecedores_atualizado_em()
returns trigger
language plpgsql
as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;

drop trigger if exists trg_encomendas_fornecedores_atualizado_em on public.encomendas_fornecedores;

create trigger trg_encomendas_fornecedores_atualizado_em
before update on public.encomendas_fornecedores
for each row
execute function public.encomendas_fornecedores_atualizado_em();

create or replace function public.admin_fornecedores_autorizado()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'worldminifigures4u@gmail.com';
$$;

create or replace function public.gerar_codigo_encomenda_fornecedor()
returns text
language plpgsql
as $$
declare
    alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_codigo text;
    i int;
begin
    loop
        v_codigo := 'F';
        for i in 1..5 loop
            v_codigo := v_codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
        end loop;
        exit when not exists (
            select 1 from public.encomendas_fornecedores ef where ef.codigo = v_codigo
        );
    end loop;
    return v_codigo;
end;
$$;

create or replace function public.listar_encomendas_fornecedores_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    return coalesce((
        select jsonb_agg(to_jsonb(ef) order by ef.criado_em desc)
        from public.encomendas_fornecedores ef
    ), '[]'::jsonb);
end;
$$;

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
        public.gerar_codigo_encomenda_fornecedor(),
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

create or replace function public.apagar_encomenda_fornecedor_admin(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    delete from public.encomendas_fornecedores where id::text = p_id;
    return true;
end;
$$;

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

            update public.produtos
            set
                novidade = case
                    when v_stock_atual <= 0 and (v_stock_atual + qtd_aplicar) > 0 then false
                    else novidade
                end,
                stock = v_stock_atual + qtd_aplicar,
                -- Stock saiu de <=0 (inclui negativo) para >0: ativar no catálogo
                ativo = (v_stock_atual + qtd_aplicar) > 0
            where id::text = produto_id_text;

            aplicado := aplicado || jsonb_build_array(jsonb_build_object(
                'produto_id', produto_id_text,
                'quantidade', qtd_aplicar,
                'solicitada', qtd_solicitada,
                'pendente_antes', qtd_pendente,
                'stock_antes', v_stock_atual,
                'stock_depois', v_stock_atual + qtd_aplicar,
                'ativado', (v_stock_atual <= 0 and (v_stock_atual + qtd_aplicar) > 0)
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

revoke execute on function public.listar_encomendas_fornecedores_admin() from public, anon;
revoke execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb) from public, anon;
revoke execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) from public, anon;
revoke execute on function public.apagar_encomenda_fornecedor_admin(text) from public, anon;
revoke execute on function public.receber_stock_fornecedor_admin(text, jsonb) from public, anon;
revoke execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) from public, anon;

grant execute on function public.listar_encomendas_fornecedores_admin() to authenticated;
grant execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb) to authenticated;
grant execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) to authenticated;
grant execute on function public.apagar_encomenda_fornecedor_admin(text) to authenticated;
grant execute on function public.receber_stock_fornecedor_admin(text, jsonb) to authenticated;
grant execute on function public.atualizar_encomenda_fornecedor_admin(text, jsonb) to authenticated;

-- Migração: permitir encomendas sem código de seguimento até o fornecedor o enviar
alter table public.encomendas_fornecedores alter column codigo drop not null;

-- Data em que o estado passou a Encomendada (não muda ao editar código)
alter table public.encomendas_fornecedores
    add column if not exists data_encomendada timestamptz;
