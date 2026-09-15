-- Executar no SQL Editor do Supabase.
-- Adiciona CTT Azul Internacional com os mesmos precos do CTT Registado nas zonas internacionais.

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
select
  zona,
  peso_ate_g,
  'ctt_azul_internacional',
  'CTT Azul Internacional',
  preco,
  ativo,
  1
from public.portes_tarifas
where zona in ('espanha', 'europa')
  and metodo_id = 'ctt_registado'
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
