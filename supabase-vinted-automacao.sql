-- =====================================================================
-- Figures Planet — Automação Vinted (07/11/2026)
-- Script do Gmail (figuresplanet.plataformas) -> função "vinted" (supabase/functions/vinted) -> vinted_processar_email.
--
-- Regras combinadas com o Rui:
--  * "Vendeste um artigo na Vinted"
--      - 1 artigo: cria logo a encomenda em Pago (data = hora do email), figura pelo título, total do email.
--      - lote ("Agrupar N artigos"): não cria nada; fica à espera do email da etiqueta.
--  * "Etiqueta de envio ..." (títulos + ID do pedido + PDF anexado):
--      - liga à venda à espera (últimos 10 dias) com o mesmo nº de artigos (e o mesmo título se for 1);
--        se houver várias, desempata pelo total (soma dos preços do site); se continuar ambíguo -> aviso, não cria.
--      - lote: cria a encomenda (Pago, data da venda) com as figuras da etiqueta.
--      - 1 artigo: usa a encomenda criada na venda.
--      - sem venda registada (encomenda criada à mão): encomenda Vinted recente com exatamente as mesmas figuras.
--      - guarda o ID do pedido em encomendas.referencia_externa e anexa o PDF (anexos-encomendas/<id>/..-Etiqueta Vinted - nome.pdf).
--  * "Este pedido está concluído": só fica registado (Concluído/fatura continuam manuais).
--  * Cliente: número de membro (clientes_perfis_externos Vinted) -> utilizador em encomendas Vinted anteriores -> cria.
--    Número de membro: encomendas anteriores ou pesquisa pública https://www.vinted.pt/member/general/search?search_text=<utilizador>
--    (só nome exato; se a pesquisa falhar, o script volta a tentar até 24 h; depois segue sem o link, com aviso).
--  * Figuras: wallapop_resolver_titulo (mesmas regras do Wallapop). Stock desce ao criar; negativo permitido com aviso.
--  * País do cliente em falta -> nota "País do cliente por preencher (necessário para a fatura)".
--  * Cada email tratado uma só vez (vinted_emails.message_id); simulação: vinted_simulacoes (nada fica nas encomendas).
--
-- Funções (código completo na base de dados: select pg_get_functiondef('public.<nome>'::regproc)):
--   vinted_membro_conhecido(text), vinted_ligar_cliente(text,text), vinted_resolver_titulos(jsonb),
--   vinted_criar_encomenda(uuid,text,text,jsonb,timestamptz,numeric,text,jsonb), vinted_aplicar_email(jsonb),
--   vinted_processar_email(jsonb, boolean)  — todas security definer, sem acesso para anon/authenticated.
-- =====================================================================

create table if not exists public.vinted_emails (
  message_id text primary key,
  tipo text not null,
  comprador text, membro_id text, n_artigos int, total numeric,
  titulos jsonb, pedido_id text, codigo_envio text, conversa text,
  recebido_em timestamptz, encomenda_id bigint, venda_message_id text,
  acao text, avisos text[], processado_em timestamptz not null default now()
);
create index if not exists vinted_emails_pedido_idx on public.vinted_emails (pedido_id);
alter table public.vinted_emails enable row level security;

create table if not exists public.vinted_simulacoes (
  id bigserial primary key, message_id text, recebido_em timestamptz, tipo text, comprador text,
  titulos jsonb, resultado jsonb, criado_em timestamptz not null default now()
);
alter table public.vinted_simulacoes enable row level security;

-- 07/11/2026 — País do comprador
-- * vinted_emails.pais; vinted_pais_conhecido(utilizador, membro) -> país da ficha (null se vazio).
-- * vinted_ligar_cliente(utilizador, membro, pais): igual ao de 2 argumentos e preenche clientes_gestao.pais só se vazio.
-- * A função "vinted" lê o país da página pública https://www.vinted.pt/member/<membro> ("country_title")
--   apenas quando a ficha ainda não tem país; vinted_aplicar_email passa-o ao cliente (venda e lote).
alter table public.vinted_emails add column if not exists pais text;

-- 2026-11-07: etiqueta Vinted no formato compacto (como o Assistente de Respostas).
-- A função "vinted" (v3) recorta o QR do PDF da Vinted e põe numa folha A4, canto superior
-- esquerdo: transportadora + nome do comprador a negrito, QR de 180pt e o código por baixo.
-- Se não encontrar o QR, anexa o PDF original. Para refazer uma etiqueta já anexada:
--   POST .../functions/v1/vinted  {"compactar_anexo":"<id>/<ficheiro>.pdf","nome":"...","transportadora":"InPost"}
--   (com "so_testar": true devolve o PDF em base64 sem gravar).

-- 2026-11-08: preços Vinted = preço do site +25%, com descontos de conjunto na Vinted
-- (2 artigos 10%, 3 artigos 15%, 5 artigos 20% -> um lote de 5 fica igual ao site).
--  * vinted_criar_encomenda: o total da Vinted manda. É repartido pelas figuras na proporção dos
--    preços do site (cêntimos de arredondamento numa linha de quantidade 1); cada linha guarda
--    "preco_site". Nota informativa "Preços das figuras ajustados…". Aviso + prioritária só se o
--    total for < 70% ou > 130% da soma do site. Cópia anterior: wallapop_config backup_vinted_criar_encomenda_20261108.
--  * vinted_total_esperado(ids jsonb): total esperado na Vinted (+25% por figura e desconto do conjunto).
--  * vinted_aplicar_email: no desempate de vendas à espera aceita também o total esperado (±0,05 €).
--    Cópia anterior: backup_vinted_aplicar_email_20261108.
