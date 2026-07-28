-- Remover "(com seguro de 25€)" do nome InPost mostrado ao cliente.
-- Correr uma vez no SQL Editor do Supabase.

update public.portes_tarifas
set
  nome_exibicao = 'InPost Registado',
  updated_at = now()
where metodo_id = 'inpost_registado'
  and nome_exibicao ilike '%seguro%';
