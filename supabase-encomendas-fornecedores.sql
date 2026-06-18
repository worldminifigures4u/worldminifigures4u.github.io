-- Figures Planet - encomendas a fornecedores
-- Executar no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.encomendas_fornecedores (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    fornecedor text not null,
    referencia text,
    estado text not null default 'A preparar'
        check (estado in ('A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada')),
    itens jsonb not null default '[]'::jsonb,
    criado_por uuid default auth.uid(),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
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
    codigo text;
    i int;
begin
    loop
        codigo := 'F';
        for i in 1..5 loop
            codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
        end loop;
        exit when not exists (
            select 1 from public.encomendas_fornecedores ef where ef.codigo = codigo
        );
    end loop;
    return codigo;
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
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    update public.encomendas_fornecedores
    set estado = p_estado
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
    rececao jsonb;
    novos_itens jsonb := '[]'::jsonb;
    produto_id_text text;
    qtd_recebida int;
    novo_recebido int;
    algum_recebido boolean := false;
    tudo_recebido boolean := true;
    atualizada public.encomendas_fornecedores;
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

    for rececao in select value from jsonb_array_elements(coalesce(p_recebidos, '[]'::jsonb)) loop
        produto_id_text := coalesce(rececao ->> 'produto_id', rececao ->> 'id');
        qtd_recebida := greatest(0, coalesce((rececao ->> 'quantidade')::int, 0));

        if produto_id_text is not null and qtd_recebida > 0 then
            update public.produtos
            set stock = coalesce(stock, 0) + qtd_recebida,
                ativo = (coalesce(stock, 0) + qtd_recebida) > 0
            where id::text = produto_id_text;
        end if;
    end loop;

    for item in select value from jsonb_array_elements(encomenda.itens) loop
        produto_id_text := item ->> 'id';
        select coalesce(sum(greatest(0, coalesce((r.value ->> 'quantidade')::int, 0))), 0)
        into qtd_recebida
        from jsonb_array_elements(coalesce(p_recebidos, '[]'::jsonb)) as r(value)
        where coalesce(r.value ->> 'produto_id', r.value ->> 'id') = produto_id_text;

        novo_recebido := coalesce((item ->> 'recebido')::int, 0) + qtd_recebida;
        if novo_recebido > 0 then
            algum_recebido := true;
        end if;
        if novo_recebido < coalesce((item ->> 'quantidade')::int, 0) then
            tudo_recebido := false;
        end if;

        novos_itens := novos_itens || jsonb_set(item, '{recebido}', to_jsonb(novo_recebido), true);
    end loop;

    update public.encomendas_fornecedores
    set itens = novos_itens,
        estado = case
            when tudo_recebido then 'Recebida'
            when algum_recebido then 'Recebida parcialmente'
            else estado
        end
    where id = encomenda.id
    returning * into atualizada;

    return to_jsonb(atualizada);
end;
$$;

revoke execute on function public.listar_encomendas_fornecedores_admin() from public, anon;
revoke execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb) from public, anon;
revoke execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) from public, anon;
revoke execute on function public.apagar_encomenda_fornecedor_admin(text) from public, anon;
revoke execute on function public.receber_stock_fornecedor_admin(text, jsonb) from public, anon;

grant execute on function public.listar_encomendas_fornecedores_admin() to authenticated;
grant execute on function public.criar_encomenda_fornecedor_admin(text, text, jsonb) to authenticated;
grant execute on function public.alterar_estado_encomenda_fornecedor_admin(text, text) to authenticated;
grant execute on function public.apagar_encomenda_fornecedor_admin(text) to authenticated;
grant execute on function public.receber_stock_fornecedor_admin(text, jsonb) to authenticated;
