-- Executar no SQL Editor do Supabase.
-- InPost: usar o total da fatura InPost (ja inclui IVA), sem multiplicar por 1.23.

update public.portes_tarifas set preco = 4.76, updated_at = now()
where zona = 'portugal' and metodo_id = 'inpost_registado' and peso_ate_g in (100, 500);

update public.portes_tarifas set preco = 5.42, updated_at = now()
where zona = 'portugal' and metodo_id = 'inpost_registado' and peso_ate_g = 1000;

update public.portes_tarifas set preco = 5.89, updated_at = now()
where zona = 'portugal' and metodo_id = 'inpost_registado' and peso_ate_g = 999999;

update public.portes_tarifas set preco = 5.12, updated_at = now()
where zona = 'espanha' and metodo_id = 'inpost_registado' and peso_ate_g in (100, 250, 500, 1000);

update public.portes_tarifas set preco = 5.81, updated_at = now()
where zona = 'espanha' and metodo_id = 'inpost_registado' and peso_ate_g = 999999;
