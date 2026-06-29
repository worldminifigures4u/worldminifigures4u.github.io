-- O webhook do Make envia os emails da nova encomenda.
-- Deve ser executado apenas para encomendas feitas diretamente no site.
-- Wallapop, OLX e Todocoleccion ficam excluidos porque tem outra origem.
--
-- SEGURANCA:
-- Nao guardar o URL real do webhook no repositorio publico.
-- Antes de executar, substituir MAKE_WEBHOOK_URL_AQUI pelo URL novo/privado do Make.

drop trigger if exists "Enviar para o Make" on public.encomendas;

create trigger "Enviar para o Make"
after insert on public.encomendas
for each row
when (new.origem = 'Site')
execute function supabase_functions.http_request(
  'MAKE_WEBHOOK_URL_AQUI',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
