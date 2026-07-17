-- Executar no SQL Editor do Supabase.
-- Adiciona CTT Normal em Espanha com os mesmos precos da Europa.

insert into public.portes_tarifas (zona, peso_ate_g, metodo_id, nome_exibicao, preco, ordem)
values
  ('espanha', 100, 'ctt_normal', 'CTT Normal', 3.26, 0),
  ('espanha', 250, 'ctt_normal', 'CTT Normal', 5.23, 0),
  ('espanha', 500, 'ctt_normal', 'CTT Normal', 8.67, 0),
  ('espanha', 1000, 'ctt_normal', 'CTT Normal', 13.35, 0),
  ('espanha', 999999, 'ctt_normal', 'CTT Normal', 22.72, 0)
on conflict (zona, peso_ate_g, metodo_id) do update
set
  preco = excluded.preco,
  nome_exibicao = excluded.nome_exibicao,
  ordem = excluded.ordem,
  ativo = true,
  updated_at = now();

-- Reordenar metodos existentes em Espanha: Normal, Registado, InPost
update public.portes_tarifas
set ordem = 1, updated_at = now()
where zona = 'espanha' and metodo_id = 'ctt_registado';

update public.portes_tarifas
set ordem = 2, updated_at = now()
where zona = 'espanha' and metodo_id = 'inpost_registado';
