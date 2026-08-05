-- Executar no SQL Editor do Supabase (atualiza banners já criados).
-- Passa a guardar texto à esquerda e à direita no banner da loja.

alter table public.banners_loja
    add column if not exists texto_esquerda text not null default '',
    add column if not exists texto_direita text not null default '';

-- Migrar o antigo "alt" para texto à esquerda (só onde ainda estiver vazio).
update public.banners_loja
set texto_esquerda = trim(coalesce(alt, ''))
where trim(coalesce(texto_esquerda, '')) = ''
  and trim(coalesce(alt, '')) <> '';

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
    if not public.is_admin() then
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

revoke execute on function public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean) from public, anon;
grant execute on function public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean) to authenticated;
