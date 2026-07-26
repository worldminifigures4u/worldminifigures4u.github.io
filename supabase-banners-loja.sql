-- Executar no SQL Editor do Supabase.
-- Banners da loja: leitura pública dos ativos; escrita só via RPCs admin.

create table if not exists public.banners_loja (
    id uuid primary key default gen_random_uuid(),
    url text not null,
    alt text not null default '',
    texto_esquerda text not null default '',
    texto_direita text not null default '',
    ordem integer not null default 0,
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

alter table public.banners_loja
    add column if not exists texto_esquerda text not null default '',
    add column if not exists texto_direita text not null default '';

create index if not exists banners_loja_ativo_ordem_idx
    on public.banners_loja (ativo, ordem, criado_em);

alter table public.banners_loja enable row level security;

grant select on table public.banners_loja to anon, authenticated;

drop policy if exists banners_loja_public_read on public.banners_loja;
create policy banners_loja_public_read
    on public.banners_loja
    for select
    to anon, authenticated
    using (ativo = true);

-- Seed dos banners atuais (só se a tabela estiver vazia).
insert into public.banners_loja (url, alt, texto_esquerda, texto_direita, ordem, ativo)
select *
from (
    values
        ('img/banner-cgi-astronauta.png', 'Figures Planet', 'Figures Planet', '', 10, true),
        ('img/banner-cgi-filme.png', '', '', '', 20, true),
        ('img/banner-cgi-duelo.png', '', '', '', 30, true)
) as seed(url, alt, texto_esquerda, texto_direita, ordem, ativo)
where not exists (select 1 from public.banners_loja limit 1);

update public.banners_loja
set texto_esquerda = trim(coalesce(alt, ''))
where trim(coalesce(texto_esquerda, '')) = ''
  and trim(coalesce(alt, '')) <> '';

create or replace function public.listar_banners_loja_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
        raise exception 'Acesso reservado ao administrador';
    end if;

    return coalesce((
        select jsonb_agg(to_jsonb(b) order by b.ordem asc, b.criado_em asc)
        from public.banners_loja b
    ), '[]'::jsonb);
end;
$$;

drop function if exists public.guardar_banner_loja_admin(uuid, text, text, integer, boolean);

create or replace function public.guardar_banner_loja_admin(
    p_id uuid default null,
    p_url text default null,
    p_texto_esquerda text default '',
    p_texto_direita text default '',
    p_ordem integer default 0,
    p_ativo boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_url text := trim(coalesce(p_url, ''));
    v_esq text := trim(coalesce(p_texto_esquerda, ''));
    v_dir text := trim(coalesce(p_texto_direita, ''));
    v_ordem integer := coalesce(p_ordem, 0);
    v_alt text;
    v_row public.banners_loja%rowtype;
begin
    if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
        raise exception 'Acesso reservado ao administrador';
    end if;

    if v_url = '' then
        raise exception 'Indique o URL do banner';
    end if;

    v_alt := nullif(trim(concat_ws(' · ', nullif(v_esq, ''), nullif(v_dir, ''))), '');

    if p_id is null then
        insert into public.banners_loja (url, alt, texto_esquerda, texto_direita, ordem, ativo)
        values (v_url, coalesce(v_alt, ''), v_esq, v_dir, v_ordem, coalesce(p_ativo, true))
        returning * into v_row;
    else
        update public.banners_loja
        set url = v_url,
            alt = coalesce(v_alt, ''),
            texto_esquerda = v_esq,
            texto_direita = v_dir,
            ordem = v_ordem,
            ativo = coalesce(p_ativo, true)
        where id = p_id
        returning * into v_row;

        if not found then
            raise exception 'Banner nao encontrado';
        end if;
    end if;

    return jsonb_build_object('sucesso', true, 'banner', to_jsonb(v_row));
end;
$$;

create or replace function public.apagar_banner_loja_admin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
        raise exception 'Acesso reservado ao administrador';
    end if;

    if p_id is null then
        raise exception 'Banner invalido';
    end if;

    delete from public.banners_loja where id = p_id;
    if not found then
        raise exception 'Banner nao encontrado';
    end if;

    return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.listar_banners_loja_admin() from public, anon;
revoke execute on function public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean) from public, anon;
revoke execute on function public.apagar_banner_loja_admin(uuid) from public, anon;

grant execute on function public.listar_banners_loja_admin() to authenticated;
grant execute on function public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.apagar_banner_loja_admin(uuid) to authenticated;
