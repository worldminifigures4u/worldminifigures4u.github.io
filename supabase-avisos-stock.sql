-- Figures Planet - avisos administrativos de stock.
-- Executar no Supabase SQL Editor.

create table if not exists public.avisos_stock (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null references public.clientes_gestao(id) on delete cascade,
    produto_id text,
    produto_nome text,
    produto_sku text,
    produto_referencia text,
    plataforma text,
    estado text not null default 'Por avisar',
    nota text not null default '',
    origem text not null default 'admin',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (estado in ('Por avisar', 'Avisado', 'Cancelado'))
);

alter table public.avisos_stock
    add column if not exists cliente_id uuid references public.clientes_gestao(id) on delete cascade,
    add column if not exists produto_id text,
    add column if not exists produto_nome text,
    add column if not exists produto_sku text,
    add column if not exists produto_referencia text,
    add column if not exists plataforma text,
    add column if not exists estado text not null default 'Por avisar',
    add column if not exists nota text not null default '',
    add column if not exists origem text not null default 'admin',
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

create index if not exists avisos_stock_cliente_idx on public.avisos_stock (cliente_id, estado, created_at desc);
create index if not exists avisos_stock_produto_id_idx on public.avisos_stock (produto_id, estado, created_at desc);
create index if not exists avisos_stock_produto_sku_idx on public.avisos_stock (upper(produto_sku), estado, created_at desc);
create index if not exists avisos_stock_produto_referencia_idx on public.avisos_stock (upper(produto_referencia), estado, created_at desc);

alter table public.avisos_stock enable row level security;
revoke all on public.avisos_stock from public, anon, authenticated;

create or replace function public.guardar_aviso_stock_admin(
    p_cliente_id uuid,
    p_produto_id text,
    p_produto_nome text,
    p_produto_sku text,
    p_produto_referencia text,
    p_plataforma text,
    p_nota text default null,
    p_origem text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_aviso public.avisos_stock;
    v_cliente_nome text;
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    select coalesce(nullif(trim(nome_utilizador), ''), nullif(trim(nome), ''), email, 'Cliente')
    into v_cliente_nome
    from public.clientes_gestao
    where id = p_cliente_id;

    if not found then
        raise exception 'Cliente nao encontrado';
    end if;

    select *
    into v_aviso
    from public.avisos_stock
    where cliente_id = p_cliente_id
      and estado = 'Por avisar'
      and (
        (nullif(trim(coalesce(p_produto_id, '')), '') is not null and produto_id = nullif(trim(p_produto_id), ''))
        or (nullif(trim(coalesce(p_produto_sku, '')), '') is not null and upper(coalesce(produto_sku, '')) = upper(trim(p_produto_sku)))
        or (nullif(trim(coalesce(p_produto_referencia, '')), '') is not null and upper(coalesce(produto_referencia, '')) = upper(trim(p_produto_referencia)))
      )
    order by created_at desc
    limit 1;

    if found then
        update public.avisos_stock
        set
            produto_nome = coalesce(nullif(trim(coalesce(p_produto_nome, '')), ''), produto_nome),
            produto_sku = coalesce(nullif(trim(coalesce(p_produto_sku, '')), ''), produto_sku),
            produto_referencia = coalesce(nullif(trim(coalesce(p_produto_referencia, '')), ''), produto_referencia),
            plataforma = coalesce(nullif(trim(coalesce(p_plataforma, '')), ''), plataforma),
            nota = coalesce(nullif(trim(coalesce(p_nota, '')), ''), nota),
            origem = coalesce(nullif(trim(coalesce(p_origem, '')), ''), origem),
            updated_at = now()
        where id = v_aviso.id
        returning * into v_aviso;
    else
        insert into public.avisos_stock (
            cliente_id, produto_id, produto_nome, produto_sku, produto_referencia,
            plataforma, nota, origem
        ) values (
            p_cliente_id,
            nullif(trim(coalesce(p_produto_id, '')), ''),
            nullif(trim(coalesce(p_produto_nome, '')), ''),
            nullif(trim(coalesce(p_produto_sku, '')), ''),
            nullif(trim(coalesce(p_produto_referencia, '')), ''),
            nullif(trim(coalesce(p_plataforma, '')), ''),
            coalesce(p_nota, ''),
            coalesce(nullif(trim(coalesce(p_origem, '')), ''), 'admin')
        )
        returning * into v_aviso;
    end if;

    return to_jsonb(v_aviso) || jsonb_build_object('cliente_nome', v_cliente_nome);
end;
$$;

create or replace function public.listar_avisos_stock_cliente_admin(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    return coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at desc)
        from public.avisos_stock a
        where a.cliente_id = p_cliente_id
    ), '[]'::jsonb);
end;
$$;

create or replace function public.listar_avisos_stock_produto_admin(
    p_produto_id text,
    p_produto_sku text,
    p_produto_referencia text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    return coalesce((
        select jsonb_agg(
            to_jsonb(a) || jsonb_build_object(
                'cliente_nome',
                coalesce(nullif(trim(c.nome_utilizador), ''), nullif(trim(c.nome), ''), c.email, 'Cliente')
            )
            order by a.created_at desc
        )
        from public.avisos_stock a
        left join public.clientes_gestao c on c.id = a.cliente_id
        where (
            nullif(trim(coalesce(p_produto_id, '')), '') is not null
            and a.produto_id = nullif(trim(p_produto_id), '')
        ) or (
            nullif(trim(coalesce(p_produto_sku, '')), '') is not null
            and upper(coalesce(a.produto_sku, '')) = upper(trim(p_produto_sku))
        ) or (
            nullif(trim(coalesce(p_produto_referencia, '')), '') is not null
            and upper(coalesce(a.produto_referencia, '')) = upper(trim(p_produto_referencia))
        )
    ), '[]'::jsonb);
end;
$$;

create or replace function public.atualizar_estado_aviso_stock_admin(
    p_id text,
    p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_aviso public.avisos_stock;
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    update public.avisos_stock
    set
        estado = case
            when p_estado in ('Por avisar', 'Avisado', 'Cancelado') then p_estado
            else estado
        end,
        updated_at = now()
    where id::text = p_id
    returning * into v_aviso;

    if v_aviso.id is null then
        raise exception 'Aviso de stock nao encontrado';
    end if;

    return to_jsonb(v_aviso);
end;
$$;

revoke execute on function public.guardar_aviso_stock_admin(uuid, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.listar_avisos_stock_cliente_admin(uuid) from public, anon;
revoke execute on function public.listar_avisos_stock_produto_admin(text, text, text) from public, anon;
revoke execute on function public.atualizar_estado_aviso_stock_admin(text, text) from public, anon;

grant execute on function public.guardar_aviso_stock_admin(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.listar_avisos_stock_cliente_admin(uuid) to authenticated;
grant execute on function public.listar_avisos_stock_produto_admin(text, text, text) to authenticated;
grant execute on function public.atualizar_estado_aviso_stock_admin(text, text) to authenticated;
