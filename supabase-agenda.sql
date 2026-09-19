-- Executar no SQL Editor do Supabase.
-- Agenda administrativa: alarmes internos só para administradores.

create table if not exists public.agenda_alarmes (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    descricao text not null default '',
    data_alarme date not null,
    hora_alarme time,
    estado text not null default 'pendente',
    prioridade text not null default 'normal',
    contexto_tipo text not null default '',
    contexto_ref text not null default '',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    constraint agenda_alarmes_estado_chk check (estado in ('pendente', 'feito')),
    constraint agenda_alarmes_prioridade_chk check (prioridade in ('baixa', 'normal', 'alta')),
    constraint agenda_alarmes_contexto_chk check (contexto_tipo in ('', 'cliente', 'encomenda', 'produto', 'fornecedor', 'outro'))
);

alter table public.agenda_alarmes
    add column if not exists descricao text not null default '',
    add column if not exists hora_alarme time,
    add column if not exists estado text not null default 'pendente',
    add column if not exists prioridade text not null default 'normal',
    add column if not exists contexto_tipo text not null default '',
    add column if not exists contexto_ref text not null default '',
    add column if not exists atualizado_em timestamptz not null default now();

create index if not exists agenda_alarmes_data_estado_idx
    on public.agenda_alarmes (data_alarme, estado, hora_alarme);

create index if not exists agenda_alarmes_estado_data_idx
    on public.agenda_alarmes (estado, data_alarme, hora_alarme);

alter table public.agenda_alarmes enable row level security;

revoke insert, update, delete on table public.agenda_alarmes from public, anon, authenticated;
revoke select on table public.agenda_alarmes from public, anon, authenticated;

create or replace function public.listar_agenda_admin()
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
        select jsonb_agg(to_jsonb(a) order by a.data_alarme asc, a.hora_alarme asc nulls last, a.criado_em asc)
        from public.agenda_alarmes a
    ), '[]'::jsonb);
end;
$$;

create or replace function public.guardar_alarme_agenda_admin(
    p_id uuid default null,
    p_titulo text default '',
    p_descricao text default '',
    p_data_alarme date default null,
    p_hora_alarme time default null,
    p_estado text default 'pendente',
    p_prioridade text default 'normal',
    p_contexto_tipo text default '',
    p_contexto_ref text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_titulo text := trim(coalesce(p_titulo, ''));
    v_descricao text := trim(coalesce(p_descricao, ''));
    v_estado text := lower(trim(coalesce(p_estado, 'pendente')));
    v_prioridade text := lower(trim(coalesce(p_prioridade, 'normal')));
    v_contexto_tipo text := lower(trim(coalesce(p_contexto_tipo, '')));
    v_contexto_ref text := trim(coalesce(p_contexto_ref, ''));
    v_row public.agenda_alarmes%rowtype;
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    if v_titulo = '' then
        raise exception 'Indique o titulo do alarme';
    end if;

    if p_data_alarme is null then
        raise exception 'Indique a data do alarme';
    end if;

    if v_estado not in ('pendente', 'feito') then
        v_estado := 'pendente';
    end if;

    if v_prioridade not in ('baixa', 'normal', 'alta') then
        v_prioridade := 'normal';
    end if;

    if v_contexto_tipo not in ('', 'cliente', 'encomenda', 'produto', 'fornecedor', 'outro') then
        v_contexto_tipo := '';
    end if;

    if p_id is null then
        insert into public.agenda_alarmes (
            titulo, descricao, data_alarme, hora_alarme,
            estado, prioridade, contexto_tipo, contexto_ref
        )
        values (
            v_titulo, v_descricao, p_data_alarme, p_hora_alarme,
            v_estado, v_prioridade, v_contexto_tipo, v_contexto_ref
        )
        returning * into v_row;
    else
        update public.agenda_alarmes
        set titulo = v_titulo,
            descricao = v_descricao,
            data_alarme = p_data_alarme,
            hora_alarme = p_hora_alarme,
            estado = v_estado,
            prioridade = v_prioridade,
            contexto_tipo = v_contexto_tipo,
            contexto_ref = v_contexto_ref,
            atualizado_em = now()
        where id = p_id
        returning * into v_row;

        if not found then
            raise exception 'Alarme nao encontrado';
        end if;
    end if;

    return jsonb_build_object('sucesso', true, 'alarme', to_jsonb(v_row));
end;
$$;

create or replace function public.alterar_estado_alarme_agenda_admin(
    p_id uuid,
    p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_estado text := lower(trim(coalesce(p_estado, 'pendente')));
    v_row public.agenda_alarmes%rowtype;
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    if p_id is null then
        raise exception 'Alarme invalido';
    end if;

    if v_estado not in ('pendente', 'feito') then
        raise exception 'Estado invalido';
    end if;

    update public.agenda_alarmes
    set estado = v_estado,
        atualizado_em = now()
    where id = p_id
    returning * into v_row;

    if not found then
        raise exception 'Alarme nao encontrado';
    end if;

    return jsonb_build_object('sucesso', true, 'alarme', to_jsonb(v_row));
end;
$$;

create or replace function public.apagar_alarme_agenda_admin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Acesso reservado ao administrador';
    end if;

    if p_id is null then
        raise exception 'Alarme invalido';
    end if;

    delete from public.agenda_alarmes where id = p_id;
    if not found then
        raise exception 'Alarme nao encontrado';
    end if;

    return jsonb_build_object('sucesso', true);
end;
$$;

revoke execute on function public.listar_agenda_admin() from public, anon;
revoke execute on function public.guardar_alarme_agenda_admin(uuid, text, text, date, time, text, text, text, text) from public, anon;
revoke execute on function public.alterar_estado_alarme_agenda_admin(uuid, text) from public, anon;
revoke execute on function public.apagar_alarme_agenda_admin(uuid) from public, anon;

grant execute on function public.listar_agenda_admin() to authenticated;
grant execute on function public.guardar_alarme_agenda_admin(uuid, text, text, date, time, text, text, text, text) to authenticated;
grant execute on function public.alterar_estado_alarme_agenda_admin(uuid, text) to authenticated;
grant execute on function public.apagar_alarme_agenda_admin(uuid) to authenticated;
