-- O webhook do Make envia os emails da nova encomenda.
-- Deve ser executado apenas para encomendas feitas diretamente no site.
-- Wallapop, OLX e Todocoleccion ficam excluídos porque têm outra origem.

drop trigger if exists "Enviar para o Make" on public.encomendas;

create trigger "Enviar para o Make"
after insert on public.encomendas
for each row
when (new.origem = 'Site')
execute function supabase_functions.http_request(
  'https://hook.eu1.make.com/wtuwjvng79rsxczzjwvkmyevg2tq147h',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
