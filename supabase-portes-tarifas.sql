-- Executar no SQL Editor do Supabase.
-- Tarifas de portes editáveis no admin (preço = o que o cliente paga, IVA incluido).

create table if not exists public.portes_tarifas (
  id uuid primary key default gen_random_uuid(),
  zona text not null check (zona in ('portugal', 'espanha', 'europa')),
  peso_ate_g integer not null check (peso_ate_g > 0),
  metodo_id text not null check (metodo_id in (
    'entrega_tomar', 'ctt_normal', 'ctt_azul', 'ctt_registado', 'inpost_registado'
  )),
  nome_exibicao text not null,
  preco numeric(10, 2) not null check (preco >= 0),
  ativo boolean not null default true,
  ordem smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique (zona, peso_ate_g, metodo_id)
);

create index if not exists portes_tarifas_zona_peso_idx
  on public.portes_tarifas (zona, peso_ate_g, ordem);

alter table public.portes_tarifas enable row level security;

drop policy if exists "Leitura publica portes ativos" on public.portes_tarifas;
create policy "Leitura publica portes ativos"
on public.portes_tarifas for select
to anon, authenticated
using (
  ativo = true
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'worldminifigures4u@gmail.com'
);

revoke insert, update, delete on public.portes_tarifas from public, anon, authenticated;
grant select on public.portes_tarifas to anon, authenticated;

create or replace function public.guardar_portes_tarifas_admin(p_linhas jsonb)
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
    raise exception 'Formato invalido: esperado um array de tarifas';
  end if;

  for item in select value from jsonb_array_elements(p_linhas)
  loop
    update public.portes_tarifas
    set
      preco = round(coalesce((item ->> 'preco')::numeric, preco), 2),
      nome_exibicao = coalesce(nullif(trim(item ->> 'nome_exibicao'), ''), nome_exibicao),
      ativo = coalesce((item ->> 'ativo')::boolean, ativo),
      updated_at = now()
    where id = (item ->> 'id')::uuid;

    if found then
      atualizados := atualizados + 1;
    end if;
  end loop;

  return jsonb_build_object('sucesso', true, 'atualizados', atualizados);
end;
$$;

revoke execute on function public.guardar_portes_tarifas_admin(jsonb) from public, anon;
grant execute on function public.guardar_portes_tarifas_admin(jsonb) to authenticated;

-- Seed inicial (precos site = tabela CTT x 1.23). Nao duplica se ja existirem linhas.
insert into public.portes_tarifas (zona, peso_ate_g, metodo_id, nome_exibicao, preco, ordem)
select v.zona, v.peso_ate_g, v.metodo_id, v.nome_exibicao, v.preco, v.ordem
from (values
  -- Portugal <= 100g
  ('portugal', 100, 'ctt_normal', 'CTT Normal', 1.94, 1),
  ('portugal', 100, 'ctt_azul', 'CTT Azul', 2.58, 2),
  ('portugal', 100, 'ctt_registado', 'CTT Registado', 5.66, 3),
  ('portugal', 100, 'inpost_registado', 'InPost Registado', 4.76, 4),
  -- Portugal <= 500g
  ('portugal', 500, 'ctt_normal', 'CTT Normal', 2.88, 1),
  ('portugal', 500, 'ctt_azul', 'CTT Azul', 4.80, 2),
  ('portugal', 500, 'ctt_registado', 'CTT Registado', 6.64, 3),
  ('portugal', 500, 'inpost_registado', 'InPost Registado', 4.76, 4),
  -- Portugal <= 1000g
  ('portugal', 1000, 'ctt_normal', 'CTT Normal', 6.83, 1),
  ('portugal', 1000, 'ctt_azul', 'CTT Azul', 9.59, 2),
  ('portugal', 1000, 'ctt_registado', 'CTT Registado', 10.98, 3),
  ('portugal', 1000, 'inpost_registado', 'InPost Registado', 5.42, 4),
  -- Portugal > 1000g
  ('portugal', 999999, 'ctt_normal', 'CTT Normal', 6.83, 1),
  ('portugal', 999999, 'ctt_azul', 'CTT Azul', 9.59, 2),
  ('portugal', 999999, 'ctt_registado', 'CTT Registado', 10.98, 3),
  ('portugal', 999999, 'inpost_registado', 'InPost Registado', 5.89, 4),
  -- Espanha (CTT = precos Europa; + InPost)
  ('espanha', 100, 'ctt_normal', 'CTT Normal', 3.26, 0),
  ('espanha', 100, 'ctt_registado', 'CTT Registado', 7.13, 1),
  ('espanha', 100, 'inpost_registado', 'InPost Registado', 5.12, 2),
  ('espanha', 250, 'ctt_normal', 'CTT Normal', 5.23, 0),
  ('espanha', 250, 'ctt_registado', 'CTT Registado', 9.29, 1),
  ('espanha', 250, 'inpost_registado', 'InPost Registado', 5.12, 2),
  ('espanha', 500, 'ctt_normal', 'CTT Normal', 8.67, 0),
  ('espanha', 500, 'ctt_registado', 'CTT Registado', 12.05, 1),
  ('espanha', 500, 'inpost_registado', 'InPost Registado', 5.12, 2),
  ('espanha', 1000, 'ctt_normal', 'CTT Normal', 13.35, 0),
  ('espanha', 1000, 'ctt_registado', 'CTT Registado', 16.24, 1),
  ('espanha', 1000, 'inpost_registado', 'InPost Registado', 5.12, 2),
  ('espanha', 999999, 'ctt_normal', 'CTT Normal', 22.72, 0),
  ('espanha', 999999, 'ctt_registado', 'CTT Registado', 26.08, 1),
  ('espanha', 999999, 'inpost_registado', 'InPost Registado', 5.81, 2),
  -- Europa
  ('europa', 100, 'ctt_normal', 'CTT Normal', 3.26, 0),
  ('europa', 100, 'ctt_registado', 'CTT Registado', 7.13, 1),
  ('europa', 250, 'ctt_normal', 'CTT Normal', 5.23, 0),
  ('europa', 250, 'ctt_registado', 'CTT Registado', 9.29, 1),
  ('europa', 500, 'ctt_normal', 'CTT Normal', 8.67, 0),
  ('europa', 500, 'ctt_registado', 'CTT Registado', 12.05, 1),
  ('europa', 1000, 'ctt_normal', 'CTT Normal', 13.35, 0),
  ('europa', 1000, 'ctt_registado', 'CTT Registado', 16.24, 1),
  ('europa', 999999, 'ctt_normal', 'CTT Normal', 22.72, 0),
  ('europa', 999999, 'ctt_registado', 'CTT Registado', 26.08, 1)
) as v(zona, peso_ate_g, metodo_id, nome_exibicao, preco, ordem)
where not exists (select 1 from public.portes_tarifas limit 1);

-- Remover entrega em mao (sempre 0) se ainda existir.
delete from public.portes_tarifas where metodo_id = 'entrega_tomar';
