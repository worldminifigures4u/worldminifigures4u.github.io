-- Executar no SQL Editor do Supabase.
-- Cores do texto do banner (base esquerda/direita + destaque com **texto**).

alter table public.banners_loja
    add column if not exists cor_esquerda text not null default '#ffffff',
    add column if not exists cor_direita text not null default '#ffffff',
    add column if not exists cor_destaque text not null default '#ffc107';

drop function if exists public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean);
drop function if exists public.guardar_banner_loja_admin(uuid, text, text, integer, boolean);

create or replace function public.guardar_banner_loja_admin(
    p_id uuid default null,
    p_url text default null,
    p_texto_esquerda text default '',
    p_texto_direita text default '',
    p_cor_esquerda text default '#ffffff',
    p_cor_direita text default '#ffffff',
    p_cor_destaque text default '#ffc107',
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
    v_cor_esq text := lower(trim(coalesce(p_cor_esquerda, '#ffffff')));
    v_cor_dir text := lower(trim(coalesce(p_cor_direita, '#ffffff')));
    v_cor_dest text := lower(trim(coalesce(p_cor_destaque, '#ffc107')));
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

    if v_cor_esq !~ '^#[0-9a-f]{6}$' then v_cor_esq := '#ffffff'; end if;
    if v_cor_dir !~ '^#[0-9a-f]{6}$' then v_cor_dir := '#ffffff'; end if;
    if v_cor_dest !~ '^#[0-9a-f]{6}$' then v_cor_dest := '#ffc107'; end if;

    v_alt := nullif(trim(regexp_replace(
        concat_ws(' · ', nullif(v_esq, ''), nullif(v_dir, '')),
        '\*+',
        '',
        'g'
    )), '');

    if p_id is null then
        insert into public.banners_loja (
            url, alt, texto_esquerda, texto_direita,
            cor_esquerda, cor_direita, cor_destaque, ordem, ativo
        )
        values (
            v_url, coalesce(v_alt, ''), v_esq, v_dir,
            v_cor_esq, v_cor_dir, v_cor_dest, v_ordem, coalesce(p_ativo, true)
        )
        returning * into v_row;
    else
        update public.banners_loja
        set url = v_url,
            alt = coalesce(v_alt, ''),
            texto_esquerda = v_esq,
            texto_direita = v_dir,
            cor_esquerda = v_cor_esq,
            cor_direita = v_cor_dir,
            cor_destaque = v_cor_dest,
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

revoke execute on function public.guardar_banner_loja_admin(uuid, text, text, text, text, text, text, integer, boolean) from public, anon;
grant execute on function public.guardar_banner_loja_admin(uuid, text, text, text, text, text, text, integer, boolean) to authenticated;
