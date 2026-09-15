-- Executar no SQL Editor do Supabase.
-- Adiciona CTT Azul Internacional como metodo independente nas zonas internacionais.

alter table public.portes_tarifas drop constraint if exists portes_tarifas_metodo_id_check;

insert into public.portes_metodos (id, nome_exibicao, registado, ativo, ordem)
values ('ctt_azul_internacional', 'CTT Azul Internacional', false, true, 3)
on conflict (id) do update
set
  nome_exibicao = excluded.nome_exibicao,
  registado = excluded.registado,
  ativo = true,
  ordem = excluded.ordem,
  updated_at = now();

update public.portes_metodos
set ordem = 4, updated_at = now()
where id = 'ctt_registado';

update public.portes_metodos
set ordem = 5, updated_at = now()
where id = 'inpost_registado';

insert into public.portes_tarifas (zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem)
select v.zona, v.peso_ate_g, v.metodo_id, v.nome_exibicao, v.preco, v.ativo, v.ordem
from (values
  ('espanha', 100, 'ctt_azul_internacional', 'CTT Azul Internacional', 7.13, true, 1),
  ('espanha', 250, 'ctt_azul_internacional', 'CTT Azul Internacional', 9.29, true, 1),
  ('espanha', 500, 'ctt_azul_internacional', 'CTT Azul Internacional', 12.05, true, 1),
  ('espanha', 1000, 'ctt_azul_internacional', 'CTT Azul Internacional', 16.24, true, 1),
  ('espanha', 999999, 'ctt_azul_internacional', 'CTT Azul Internacional', 26.08, true, 1),
  ('europa', 100, 'ctt_azul_internacional', 'CTT Azul Internacional', 7.13, true, 1),
  ('europa', 250, 'ctt_azul_internacional', 'CTT Azul Internacional', 9.29, true, 1),
  ('europa', 500, 'ctt_azul_internacional', 'CTT Azul Internacional', 12.05, true, 1),
  ('europa', 1000, 'ctt_azul_internacional', 'CTT Azul Internacional', 16.24, true, 1),
  ('europa', 999999, 'ctt_azul_internacional', 'CTT Azul Internacional', 26.08, true, 1)
) as v(zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem)
on conflict (zona, peso_ate_g, metodo_id) do update
set
  nome_exibicao = excluded.nome_exibicao,
  preco = excluded.preco,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  updated_at = now();

update public.portes_tarifas
set ordem = 2, updated_at = now()
where zona in ('espanha', 'europa')
  and metodo_id = 'ctt_registado';

update public.portes_tarifas
set ordem = 3, updated_at = now()
where zona = 'espanha'
  and metodo_id = 'inpost_registado';
