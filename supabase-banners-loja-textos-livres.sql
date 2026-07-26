-- Executar no SQL Editor do Supabase.
-- Textos livres no banner (lista JSON com posição x/y em %).

alter table public.banners_loja
    add column if not exists textos jsonb not null default '[]'::jsonb;

-- Migrar textos esq/dir antigos para a lista (só se textos estiver vazio).
update public.banners_loja b
set textos = coalesce((
    select jsonb_agg(v.item order by v.ord)
    from (
        values
            (
                1,
                case when trim(coalesce(b.texto_esquerda, '')) <> '' then jsonb_build_object(
                    'id', 'legado-esq-' || b.id::text,
                    'texto', b.texto_esquerda,
                    'cor', coalesce(nullif(b.cor_esquerda, ''), '#ffffff'),
                    'cor_destaque', coalesce(nullif(b.cor_destaque, ''), '#ffc107'),
                    'x', 10,
                    'y', 50,
                    'maxWidth', 28,
                    'align', 'left'
                ) else null end
            ),
            (
                2,
                case when trim(coalesce(b.texto_direita, '')) <> '' then jsonb_build_object(
                    'id', 'legado-dir-' || b.id::text,
                    'texto', b.texto_direita,
                    'cor', coalesce(nullif(b.cor_direita, ''), '#ffffff'),
                    'cor_destaque', coalesce(nullif(b.cor_destaque, ''), '#ffc107'),
                    'x', 90,
                    'y', 50,
                    'maxWidth', 28,
                    'align', 'right'
                ) else null end
            )
    ) as v(ord, item)
    where v.item is not null
), '[]'::jsonb)
where coalesce(b.textos, '[]'::jsonb) = '[]'::jsonb
  and (
    trim(coalesce(b.texto_esquerda, '')) <> ''
    or trim(coalesce(b.texto_direita, '')) <> ''
  );

drop function if exists public.guardar_banner_loja_admin(uuid, text, text, text, text, text, text, integer, boolean);
drop function if exists public.guardar_banner_loja_admin(uuid, text, text, text, integer, boolean);
drop function if exists public.guardar_banner_loja_admin(uuid, text, text, integer, boolean);

create or replace function public.guardar_banner_loja_admin(
    p_id uuid default null,
    p_url text default null,
    p_textos jsonb default '[]'::jsonb,
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
    v_textos jsonb := coalesce(p_textos, '[]'::jsonb);
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

    if jsonb_typeof(v_textos) <> 'array' then
        v_textos := '[]'::jsonb;
    end if;

    v_alt := nullif(trim(regexp_replace(
        coalesce((
            select string_agg(trim(coalesce(t ->> 'texto', '')), ' · ' order by ord)
            from jsonb_array_elements(v_textos) with ordinality as x(t, ord)
            where trim(coalesce(t ->> 'texto', '')) <> ''
        ), ''),
        '\*+',
        '',
        'g'
    )), '');

    if p_id is null then
        insert into public.banners_loja (url, alt, textos, ordem, ativo)
        values (v_url, coalesce(v_alt, ''), v_textos, v_ordem, coalesce(p_ativo, true))
        returning * into v_row;
    else
        update public.banners_loja
        set url = v_url,
            alt = coalesce(v_alt, ''),
            textos = v_textos,
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

revoke execute on function public.guardar_banner_loja_admin(uuid, text, jsonb, integer, boolean) from public, anon;
grant execute on function public.guardar_banner_loja_admin(uuid, text, jsonb, integer, boolean) to authenticated;
