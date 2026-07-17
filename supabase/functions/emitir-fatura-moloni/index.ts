import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MOLONI_API_URL = "https://api.molonion.pt/v1";
const DEFAULT_ADMIN_EMAIL = "worldminifigures4u@gmail.com";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://figuresplanet.com",
  "https://www.figuresplanet.com",
  "https://worldminifigures4u.github.io",
  "http://localhost:5500",
  "http://localhost:8000",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8000",
];
const IVA_FATOR = 1.23;
const LOTE_DESCRICAO = "Lote diverso de figuras";
const PORTES_DESCRICAO = "Portes de envio";
const ORIGENS_FATURA_MOLONI_OPCIONAL = new Set(["olx"]);

type MoloniError = { field?: string; msg?: string };
type MoloniInvoiceResult = {
  documentId?: number;
  number?: number | string;
  status?: number;
  totalValue?: number;
};

type EncomendaRow = {
  id: string;
  codigo_encomenda: string | null;
  estado: string | null;
  origem: string | null;
  total: number | string | null;
  portes: number | string | null;
  metodo_pagamento: string | null;
  pais_cliente: string | null;
  regiao_envio: string | null;
  moloni_document_id: number | null;
  moloni_fatura_numero: string | null;
  data_pagamento: string | null;
  created_at: string | null;
};

type DocumentProductLine = {
  productId: number;
  qty: number;
  ordering: number;
  price: number;
  name: string;
};

function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins();
  const isAllowed = allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://figuresplanet.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

function adminEmails(): string[] {
  return (Deno.env.get("ADMIN_EMAILS") || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function origemPermiteFaturaMoloni(
  origem: string | null | undefined,
  forcarOlx: boolean,
): boolean {
  const normalizada = normalizarTexto(origem || "site");
  if (normalizada === "olx") return forcarOlx;
  return !ORIGENS_FATURA_MOLONI_OPCIONAL.has(normalizada);
}

function lerIdPagamentoMoloni(...nomesEnv: string[]): number {
  for (const nome of nomesEnv) {
    const valor = Number(Deno.env.get(nome) || "0");
    if (valor > 0) return valor;
  }
  return 0;
}

type PagamentosMoloniConfig = {
  mbWay: number;
  transferencia: number;
  paypal: number;
  dinheiro: number;
  cartao: number;
  default: number;
};

function carregarPagamentosMoloni(): PagamentosMoloniConfig {
  const transferencia = lerIdPagamentoMoloni(
    "MOLONI_PAYMENT_TRANSFERENCIA",
    "MOLONI_PAYMENT_METHOD_ID",
  );
  const defaultId = lerIdPagamentoMoloni(
    "MOLONI_PAYMENT_DEFAULT",
    "MOLONI_PAYMENT_TRANSFERENCIA",
    "MOLONI_PAYMENT_METHOD_ID",
  );

  return {
    mbWay: lerIdPagamentoMoloni("MOLONI_PAYMENT_MB_WAY", "MOLONI_PAYMENT_TRANSFERENCIA", "MOLONI_PAYMENT_METHOD_ID") || transferencia || defaultId,
    transferencia: transferencia || defaultId,
    paypal: lerIdPagamentoMoloni("MOLONI_PAYMENT_PAYPAL"),
    dinheiro: lerIdPagamentoMoloni("MOLONI_PAYMENT_DINHEIRO"),
    cartao: lerIdPagamentoMoloni("MOLONI_PAYMENT_CARTAO"),
    default: defaultId,
  };
}

function resolverPaymentMethodId(
  metodoPagamento: string | null | undefined,
  pagamentos: PagamentosMoloniConfig,
): number {
  const metodo = normalizarTexto(metodoPagamento);

  if (metodo.includes("paypal")) {
    return pagamentos.paypal || pagamentos.default;
  }
  if (metodo.includes("mb way") || metodo === "mbway") {
    return pagamentos.mbWay || pagamentos.transferencia || pagamentos.default;
  }
  if (metodo.includes("transferencia")) {
    return pagamentos.transferencia || pagamentos.default;
  }
  if (metodo.includes("dinheiro") || metodo.includes("numerario")) {
    return pagamentos.dinheiro || pagamentos.default;
  }
  if (metodo.includes("cartao")) {
    return pagamentos.cartao || pagamentos.default;
  }

  return pagamentos.default;
}

function validarPagamentosMoloni(pagamentos: PagamentosMoloniConfig): string | null {
  if (pagamentos.default > 0) return null;
  if (pagamentos.transferencia > 0) return null;
  return "Configuracao Moloni incompleta: falta MOLONI_PAYMENT_TRANSFERENCIA ou MOLONI_PAYMENT_DEFAULT.";
}

function numero(valor: unknown): number {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function arredondarEuro(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function arredondarPrecisao(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function precoLiquido(valorBruto: number): number {
  if (valorBruto <= 0) return 0;
  return arredondarEuro(valorBruto / IVA_FATOR);
}

/** Total com IVA como o Moloni apura no método "ao documento": round(líquido × 1.23, 2). */
function totalComIvaDocumento(somaLiquida: number): number {
  return arredondarEuro(somaLiquida * IVA_FATOR);
}

/**
 * Converte totais brutos (com IVA) em preços líquidos enviados ao Moloni.
 * Com arredondamento ao documento, alguns totais (ex.: 41,90€) são impossíveis
 * com líquidos a 2 casas — nesses casos usamos mais precisão para o total bater.
 */
function precosLiquidosParaTotalBruto(valoresBrutos: number[], totalBrutoAlvo: number): number[] {
  const brutos = valoresBrutos.map((valor) => arredondarEuro(Math.max(0, valor)));
  if (!brutos.length) return [];

  let liquidos = brutos.map((valor) => precoLiquido(valor));
  const soma = (valores: number[]) => valores.reduce((acc, valor) => acc + valor, 0);

  if (totalComIvaDocumento(soma(liquidos)) === totalBrutoAlvo) {
    return liquidos;
  }

  const indiceAjuste = liquidos.reduce(
    (melhor, valor, indice, lista) => (valor >= lista[melhor] ? indice : melhor),
    0,
  );

  for (const delta of [-0.01, 0.01, -0.02, 0.02, -0.03, 0.03]) {
    const tentativa = liquidos.map((valor, indice) =>
      indice === indiceAjuste ? arredondarEuro(valor + delta) : valor
    );
    if (tentativa[indiceAjuste] <= 0) continue;
    if (totalComIvaDocumento(soma(tentativa)) === totalBrutoAlvo) {
      return tentativa;
    }
  }

  // Fallback: repartir o líquido exacto (total/1.23) com 6 casas para o IVA ao documento fechar.
  const liquidoExacto = totalBrutoAlvo / IVA_FATOR;
  const somaBrutos = soma(brutos);
  if (somaBrutos <= 0) return liquidos;

  const precisos: number[] = [];
  let acumulado = 0;
  for (let indice = 0; indice < brutos.length; indice += 1) {
    if (indice === brutos.length - 1) {
      precisos.push(arredondarPrecisao(liquidoExacto - acumulado, 6));
      break;
    }
    const parcela = arredondarPrecisao((brutos[indice] / somaBrutos) * liquidoExacto, 6);
    precisos.push(parcela);
    acumulado = arredondarPrecisao(acumulado + parcela, 6);
  }

  if (totalComIvaDocumento(soma(precisos)) === totalBrutoAlvo) {
    return precisos;
  }

  return liquidos;
}

function formatarDataIso(data: Date): string {
  return data.toISOString();
}

function formatarDataVencimento(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function adicionarDias(data: Date, dias: number): Date {
  const copia = new Date(data);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function mensagemErrosMoloni(erros: MoloniError[] | null | undefined): string {
  if (!erros?.length) return "Erro desconhecido ao criar fatura no Moloni.";
  return erros.map((erro) => `${erro.field || "campo"}: ${erro.msg || "erro"}`).join("; ");
}

function resolverDestinoFatura(encomenda: EncomendaRow): "PT" | "EST" {
  const candidatos = [
    encomenda.pais_cliente,
    encomenda.regiao_envio,
  ]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean);

  const paisNormalizado = normalizarTexto(candidatos[0] || "portugal");
  const ePortugal = !paisNormalizado
    || paisNormalizado === "portugal"
    || paisNormalizado === "pt"
    || paisNormalizado.startsWith("portugal");

  return ePortugal ? "PT" : "EST";
}

async function moloniRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = Deno.env.get("MOLONI_API_KEY");
  if (!apiKey) {
    throw new Error("MOLONI_API_KEY em falta.");
  }

  const resposta = await fetch(MOLONI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(`Moloni HTTP ${resposta.status}.`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((erro: { message?: string }) => erro.message || "erro GraphQL").join("; "));
  }

  return payload as T;
}

function construirLinhasFatura(
  totalBruto: number,
  portesBruto: number,
  productIdLote: number,
  productIdPortes: number,
): DocumentProductLine[] {
  const valorProdutosBruto = arredondarEuro(Math.max(0, totalBruto - portesBruto));
  const valorPortesBruto = arredondarEuro(Math.max(0, portesBruto));
  const totalBrutoAlvo = arredondarEuro(totalBruto);

  const brutos: number[] = [];
  const metadados: Array<{ productId: number; name: string }> = [];

  if (valorProdutosBruto > 0) {
    brutos.push(valorProdutosBruto);
    metadados.push({ productId: productIdLote, name: LOTE_DESCRICAO });
  }
  if (valorPortesBruto > 0) {
    brutos.push(valorPortesBruto);
    metadados.push({ productId: productIdPortes, name: PORTES_DESCRICAO });
  }

  if (!brutos.length) {
    throw new Error("A encomenda nao tem valor faturavel.");
  }

  const precos = precosLiquidosParaTotalBruto(brutos, totalBrutoAlvo);

  return metadados.map((meta, indice) => ({
    productId: meta.productId,
    qty: 1,
    ordering: indice + 1,
    price: precos[indice],
    name: meta.name,
  }));
}

function parseDataPagamento(valor: string | null | undefined): Date {
  if (!valor) return new Date();
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return new Date();
  return data;
}

async function criarFaturaReciboMoloni(
  encomenda: EncomendaRow,
  companyId: number,
  documentSetId: number,
  customerId: number,
  productIdLote: number,
  productIdPortes: number,
  paymentMethodId: number,
  invoiceStatus: number,
) {
  const dataEmissao = new Date();
  const dataPagamento = parseDataPagamento(encomenda.data_pagamento || encomenda.created_at);
  const vencimento = adicionarDias(dataEmissao, 30);
  const totalBruto = numero(encomenda.total);
  const portesBruto = numero(encomenda.portes);
  const linhas = construirLinhasFatura(totalBruto, portesBruto, productIdLote, productIdPortes);
  const referencia = String(encomenda.codigo_encomenda || encomenda.id).trim();
  const destino = resolverDestinoFatura(encomenda);

  const query = `
    mutation EmitirFaturaReciboMoloni($companyId: Int!, $data: InvoiceReceiptInsert!) {
      invoiceReceiptCreate(companyId: $companyId, data: $data) {
        errors { field msg }
        data {
          documentId
          number
          status
          totalValue
        }
      }
    }
  `;

  const payload = await moloniRequest<{
    data?: { invoiceReceiptCreate?: { errors?: MoloniError[]; data?: MoloniInvoiceResult } };
  }>(query, {
    companyId,
    data: {
      documentSetId,
      customerId,
      date: formatarDataIso(dataEmissao),
      expirationDate: formatarDataVencimento(vencimento),
      status: invoiceStatus,
      yourReference: referencia,
      ourReference: destino,
      products: linhas,
      payments: [
        {
          paymentMethodId,
          value: totalBruto,
          date: formatarDataIso(dataPagamento),
        },
      ],
    },
  });

  const resultado = payload.data?.invoiceReceiptCreate;
  if (resultado?.errors?.length) {
    throw new Error(mensagemErrosMoloni(resultado.errors));
  }
  if (!resultado?.data?.documentId) {
    throw new Error("Moloni nao devolveu documentId.");
  }

  const totalEmitido = numero(resultado.data.totalValue);
  if (totalEmitido > 0 && arredondarEuro(totalEmitido) !== arredondarEuro(totalBruto)) {
    console.warn(
      `Fatura Moloni ${resultado.data.documentId}: total emitido ${totalEmitido} != total encomenda ${totalBruto}`,
    );
  }

  return { ...resultado.data, destino };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const companyId = Number(Deno.env.get("MOLONI_COMPANY_ID") || "0");
  const documentSetId = Number(Deno.env.get("MOLONI_DOCUMENT_SET_ID") || "0");
  const customerId = Number(Deno.env.get("MOLONI_CUSTOMER_ID") || "0");
  const productIdLote = Number(Deno.env.get("MOLONI_PRODUCT_ID_LOTE") || "0");
  const productIdPortes = Number(Deno.env.get("MOLONI_PRODUCT_ID_PORTES") || productIdLote || "0");
  const pagamentosMoloni = carregarPagamentosMoloni();
  const invoiceStatus = Number(Deno.env.get("MOLONI_INVOICE_STATUS") || "0");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(request, { error: "Configuracao Supabase incompleta." }, 500);
  }
  const erroPagamentos = validarPagamentosMoloni(pagamentosMoloni);
  if (!companyId || !documentSetId || !customerId || !productIdLote || erroPagamentos) {
    return jsonResponse(request, { error: erroPagamentos || "Configuracao Moloni incompleta." }, 500);
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(request, { error: "Sessao obrigatoria." }, 401);
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
  const email = String(authData?.user?.email || "").toLowerCase();

  if (authError || !email || !adminEmails().includes(email)) {
    return jsonResponse(request, { error: "Acesso reservado ao administrador." }, 403);
  }

  let body: { encomenda_id?: string; forcar_olx?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "JSON invalido." }, 400);
  }

  const forcarOlx = body.forcar_olx === true;
  const encomendaId = String(body.encomenda_id || "").trim();
  if (!encomendaId) {
    return jsonResponse(request, { error: "encomenda_id obrigatorio." }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: encomenda, error: encomendaError } = await supabaseAdmin
    .from("encomendas")
    .select("id, codigo_encomenda, estado, origem, total, portes, metodo_pagamento, pais_cliente, regiao_envio, moloni_document_id, moloni_fatura_numero, data_pagamento, created_at")
    .eq("id", encomendaId)
    .maybeSingle();

  if (encomendaError || !encomenda) {
    return jsonResponse(request, { error: "Encomenda nao encontrada." }, 404);
  }

  const encomendaRow = encomenda as EncomendaRow;

  if (!origemPermiteFaturaMoloni(encomendaRow.origem, forcarOlx)) {
    return jsonResponse(request, { ignorada: true, motivo: "origem_olx" });
  }

  if (normalizarTexto(encomendaRow.estado) !== "concluido") {
    return jsonResponse(request, { error: "A encomenda tem de estar no estado Concluído." }, 409);
  }

  if (encomendaRow.moloni_document_id) {
    return jsonResponse(request, {
      sucesso: true,
      ja_emitida: true,
      document_id: encomendaRow.moloni_document_id,
      numero: encomendaRow.moloni_fatura_numero,
    });
  }

  try {
    const paymentMethodId = resolverPaymentMethodId(encomendaRow.metodo_pagamento, pagamentosMoloni);
    if (!paymentMethodId) {
      throw new Error("Nao foi possivel determinar o metodo de pagamento Moloni para esta encomenda.");
    }

    const fatura = await criarFaturaReciboMoloni(
      encomendaRow,
      companyId,
      documentSetId,
      customerId,
      productIdLote,
      productIdPortes,
      paymentMethodId,
      invoiceStatus,
    );

    const numeroFatura = fatura.number != null ? String(fatura.number) : null;
    const { error: updateError } = await supabaseAdmin
      .from("encomendas")
      .update({
        moloni_document_id: fatura.documentId,
        moloni_fatura_numero: numeroFatura,
        moloni_fatura_emitida_em: new Date().toISOString(),
        moloni_fatura_erro: null,
      })
      .eq("id", encomendaId);

    if (updateError) {
      return jsonResponse(request, {
        sucesso: true,
        aviso: "Fatura-recibo criada no Moloni, mas nao foi possivel guardar na encomenda.",
        document_id: fatura.documentId,
        numero: numeroFatura,
        total: fatura.totalValue,
      });
    }

    return jsonResponse(request, {
      sucesso: true,
      tipo: "fatura_recibo",
      document_id: fatura.documentId,
      numero: numeroFatura,
      total: fatura.totalValue,
      status: fatura.status,
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro ao emitir fatura.";
    await supabaseAdmin
      .from("encomendas")
      .update({ moloni_fatura_erro: mensagem })
      .eq("id", encomendaId);

    return jsonResponse(request, { sucesso: false, error: mensagem }, 502);
  }
});
