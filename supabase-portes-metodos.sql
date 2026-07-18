-- Executar no SQL Editor do Supabase.
-- Catalogo de metodos de envio (registado = com rastreamento no carrinho).

create table if not exists public.portes_metodos (
  id text primary key,
  nome_exibicao text not null,
  registado boolean not null default false,
  ativo boolean not null default true,
  ordem smallint not null default 0,
  updated_at timestamptz not null default now(),
  constraint portes_metodos_id_formato check (id ~ '^[a-z0-9_]+$')
);

alter table public.portes_metodos enable row level security;

drop policy if exists "Leitura portes metodos" on public.portes_metodos;
create policy "Leitura portes metodos"
on public.portes_metodos for select
to anon, authenticated
using (
  ativo = true
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'worldminifigures4u@gmail.com'
);

revoke insert, update, delete on public.portes_metodos from public, anon, authenticated;
grant select on public.portes_metodos to anon, authenticated;

-- Remover lista fechada de metodos nas tarifas (passa a aceitar ids do catalogo).
alter table public.portes_tarifas drop constraint if exists portes_tarifas_metodo_id_check;

insert into public.portes_metodos (id, nome_exibicao, registado, ordem)
values
  ('ctt_normal', 'CTT Normal', false, 1),
  ('ctt_azul', 'CTT Azul', false, 2),
  ('ctt_registado', 'CTT Registado', true, 3),
  ('inpost_registado', 'InPost Registado', true, 4)
on conflict (id) do update
set
  nome_exibicao = excluded.nome_exibicao,
  registado = excluded.registado,
  ordem = excluded.ordem,
  updated_at = now();

create or replace function public.guardar_portes_metodos_admin(p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  atualizados integer := 0;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Formato invalido: esperado um array de metodos';
  end if;

  for item in select value from jsonb_array_elements(p_linhas)
  loop
    update public.portes_metodos
    set
      nome_exibicao = coalesce(nullif(trim(item ->> 'nome_exibicao'), ''), nome_exibicao),
      registado = coalesce((item ->> 'registado')::boolean, registado),
      ativo = coalesce((item ->> 'ativo')::boolean, ativo),
      ordem = coalesce((item ->> 'ordem')::smallint, ordem),
      updated_at = now()
    where id = trim(item ->> 'id');

    if found then
      atualizados := atualizados + 1;
    end if;
  end loop;

  return jsonb_build_object('sucesso', true, 'atualizados', atualizados);
end;
$$;

create or replace function public.criar_portes_metodo_admin(
  p_id text,
  p_nome_exibicao text,
  p_registado boolean default false,
  p_preco_inicial numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_nome text;
  v_ordem smallint;
  v_linhas integer := 0;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  v_id := lower(trim(coalesce(p_id, '')));
  v_nome := trim(coalesce(p_nome_exibicao, ''));

  if v_id = '' or v_id !~ '^[a-z0-9_]+$' then
    raise exception 'ID invalido. Usa apenas letras minusculas, numeros e underscore.';
  end if;
  if v_nome = '' then
    raise exception 'Indica o nome do metodo.';
  end if;
  if exists (select 1 from public.portes_metodos where id = v_id) then
    raise exception 'Ja existe um metodo com este ID.';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem from public.portes_metodos;

  insert into public.portes_metodos (id, nome_exibicao, registado, ativo, ordem)
  values (v_id, v_nome, coalesce(p_registado, false), true, v_ordem);

  -- Cria tarifas inativas (preco inicial) em todos os escaloes existentes.
  insert into public.portes_tarifas (zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem)
  select distinct
    t.zona,
    t.peso_ate_g,
    v_id,
    v_nome,
    greatest(0, round(coalesce(p_preco_inicial, 0), 2)),
    false,
    v_ordem
  from public.portes_tarifas t
  on conflict (zona, peso_ate_g, metodo_id) do nothing;

  get diagnostics v_linhas = row_count;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_id,
    'tarifas_criadas', v_linhas
  );
end;
$$;

revoke execute on function public.guardar_portes_metodos_admin(jsonb) from public, anon;
grant execute on function public.guardar_portes_metodos_admin(jsonb) to authenticated;
revoke execute on function public.criar_portes_metodo_admin(text, text, boolean, numeric) from public, anon;
grant execute on function public.criar_portes_metodo_admin(text, text, boolean, numeric) to authenticated;
