import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGENS_PERMITIDAS = new Set([
  "https://figuresplanet.com",
  "https://www.figuresplanet.com",
  "https://worldminifigures4u.github.io",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const origemPermitida = ORIGENS_PERMITIDAS.has(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");

  return {
    "Access-Control-Allow-Origin": origemPermitida ? origin : "https://figuresplanet.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

type ItemPedido = {
  id_produto: string | number;
  quantidade: number;
};

type Produto = {
  id: string | number;
  sku?: string | null;
  nome: string;
  preco: number;
  peso?: number | null;
  stock?: number | null;
  ativo?: boolean | null;
};

type Cliente = {
  nome?: string | null;
  email?: string | null;
  telemovel?: string | null;
  morada?: string | null;
  cp?: string | null;
  cidade?: string | null;
  pais?: string | null;
};

const PESO_PADRAO_PRODUTO_GRAMAS = 10;
const PORTES_PESO_ABERTO_G = 999999;
type OpcaoEnvio = {
  id: string;
  nome: string;
  valor: number;
};

const TABELA_PORTES_FALLBACK: Record<string, Array<{ ate: number; opcoes: OpcaoEnvio[] }>> = {
  portugal: [
    { ate: 100, opcoes: [
      { id: "entrega_tomar", nome: "Entrega em Tomar (Portugal)", valor: 0 },
      { id: "ctt_normal", nome: "CTT Normal", valor: 1.94 },
      { id: "ctt_azul", nome: "CTT Azul", valor: 2.58 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 5.66 },
      { id: "inpost_registado", nome: "InPost Registado (com seguro de 25\u20ac)", valor: 5.85 },
    ]},
    { ate: 500, opcoes: [
      { id: "entrega_tomar", nome: "Entrega em Tomar (Portugal)", valor: 0 },
      { id: "ctt_normal", nome: "CTT Normal", valor: 2.88 },
      { id: "ctt_azul", nome: "CTT Azul", valor: 4.80 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 6.64 },
      { id: "inpost_registado", nome: "InPost Registado (com seguro de 25\u20ac)", valor: 5.85 },
    ]},
    { ate: 1000, opcoes: [
      { id: "entrega_tomar", nome: "Entrega em Tomar (Portugal)", valor: 0 },
      { id: "ctt_normal", nome: "CTT Normal", valor: 6.83 },
      { id: "ctt_azul", nome: "CTT Azul", valor: 9.59 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 10.98 },
      { id: "inpost_registado", nome: "InPost Registado (com seguro de 25\u20ac)", valor: 6.67 },
    ]},
    { ate: Infinity, opcoes: [
      { id: "entrega_tomar", nome: "Entrega em Tomar (Portugal)", valor: 0 },
      { id: "ctt_normal", nome: "CTT Normal", valor: 6.83 },
      { id: "ctt_azul", nome: "CTT Azul", valor: 9.59 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 10.98 },
      { id: "inpost_registado", nome: "InPost Registado (com seguro de 25\u20ac)", valor: 7.24 },
    ]},
  ],
  espanha: [
    { ate: 100, opcoes: [
      { id: "ctt_registado", nome: "CTT Registado", valor: 7.13 },
      { id: "inpost_registado", nome: "InPost Registado", valor: 6.30 },
    ]},
    { ate: 250, opcoes: [
      { id: "ctt_registado", nome: "CTT Registado", valor: 9.29 },
      { id: "inpost_registado", nome: "InPost Registado", valor: 6.30 },
    ]},
    { ate: 500, opcoes: [
      { id: "ctt_registado", nome: "CTT Registado", valor: 12.05 },
      { id: "inpost_registado", nome: "InPost Registado", valor: 6.30 },
    ]},
    { ate: 1000, opcoes: [
      { id: "ctt_registado", nome: "CTT Registado", valor: 16.24 },
      { id: "inpost_registado", nome: "InPost Registado", valor: 6.30 },
    ]},
    { ate: Infinity, opcoes: [
      { id: "ctt_registado", nome: "CTT Registado", valor: 26.08 },
      { id: "inpost_registado", nome: "InPost Registado", valor: 7.15 },
    ]},
  ],
  europa: [
    { ate: 100, opcoes: [
      { id: "ctt_normal", nome: "CTT Normal", valor: 3.26 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 7.13 },
    ]},
    { ate: 250, opcoes: [
      { id: "ctt_normal", nome: "CTT Normal", valor: 5.23 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 9.29 },
    ]},
    { ate: 500, opcoes: [
      { id: "ctt_normal", nome: "CTT Normal", valor: 8.67 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 12.05 },
    ]},
    { ate: 1000, opcoes: [
      { id: "ctt_normal", nome: "CTT Normal", valor: 13.35 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 16.24 },
    ]},
    { ate: Infinity, opcoes: [
      { id: "ctt_normal", nome: "CTT Normal", valor: 22.72 },
      { id: "ctt_registado", nome: "CTT Registado", valor: 26.08 },
    ]},
  ],
};

let TABELA_PORTES_POR_PESO = TABELA_PORTES_FALLBACK;

const ZONA_PORTES_POR_PAIS: Record<string, string> = {
  portugal: "portugal",
  espanha: "espanha",
  alemanha: "europa",
  austria: "europa",
  belgica: "europa",
  bulgaria: "europa",
  chequia: "europa",
  chipre: "europa",
  croacia: "europa",
  dinamarca: "europa",
  eslovaquia: "europa",
  eslovenia: "europa",
  estonia: "europa",
  finlandia: "europa",
  franca: "europa",
  grecia: "europa",
  hungria: "europa",
  irlanda: "europa",
  italia: "europa",
  letonia: "europa",
  lituania: "europa",
  luxemburgo: "europa",
  malta: "europa",
  paises_baixos: "europa",
  polonia: "europa",
  romenia: "europa",
  suecia: "europa",
};

function obterZonaPortesPorPais(regiao: string) {
  return ZONA_PORTES_POR_PAIS[regiao] || "europa";
}

type LinhaPortesDb = {
  zona: string;
  peso_ate_g: number;
  metodo_id: string;
  nome_exibicao: string;
  preco: number;
  ativo?: boolean | null;
  ordem?: number | null;
};

function montarTabelaPortesDeLinhas(linhas: LinhaPortesDb[]) {
  const tabela: Record<string, Array<{ ate: number; opcoes: OpcaoEnvio[]; _ordemPeso?: number }>> = {
    portugal: [],
    espanha: [],
    europa: [],
  };
  const porZonaPeso = new Map<string, { ate: number; opcoes: Array<OpcaoEnvio & { _ordem?: number }>; _ordemPeso: number }>();

  for (const linha of linhas) {
    if (!linha || linha.ativo === false) continue;
    const zona = String(linha.zona || "");
    if (!tabela[zona]) continue;
    const pesoNum = Number(linha.peso_ate_g);
    const pesoAte = !Number.isFinite(pesoNum) || pesoNum >= PORTES_PESO_ABERTO_G ? Infinity : pesoNum;
    const chave = `${zona}|${linha.peso_ate_g}`;
    if (!porZonaPeso.has(chave)) {
      const escalao = { ate: pesoAte, opcoes: [] as Array<OpcaoEnvio & { _ordem?: number }>, _ordemPeso: pesoNum || 0 };
      porZonaPeso.set(chave, escalao);
      tabela[zona].push(escalao);
    }
    porZonaPeso.get(chave)!.opcoes.push({
      id: String(linha.metodo_id || ""),
      nome: String(linha.nome_exibicao || linha.metodo_id || ""),
      valor: Math.round(Number(linha.preco || 0) * 100) / 100,
      _ordem: Number(linha.ordem || 0),
    });
  }

  for (const zona of Object.keys(tabela)) {
    tabela[zona].sort((a, b) => (a._ordemPeso || 0) - (b._ordemPeso || 0));
    for (const escalao of tabela[zona]) {
      escalao.opcoes.sort((a, b) => (a._ordem || 0) - (b._ordem || 0));
      for (const opcao of escalao.opcoes) delete opcao._ordem;
      delete escalao._ordemPeso;
    }
  }

  if (!tabela.portugal.length && !tabela.espanha.length && !tabela.europa.length) {
    return null;
  }
  return tabela as typeof TABELA_PORTES_FALLBACK;
}

async function carregarTabelaPortesRemota(adminClient: ReturnType<typeof createClient>) {
  const { data, error } = await adminClient
    .from("portes_tarifas")
    .select("zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem")
    .eq("ativo", true)
    .order("zona")
    .order("peso_ate_g")
    .order("ordem");

  if (error || !data?.length) {
    TABELA_PORTES_POR_PESO = TABELA_PORTES_FALLBACK;
    return;
  }

  const montada = montarTabelaPortesDeLinhas(data as LinhaPortesDb[]);
  TABELA_PORTES_POR_PESO = montada || TABELA_PORTES_FALLBACK;
}

function obterOpcoesEnvio(regiao: string, pesoTotal: number) {
  if (pesoTotal <= 0) return [];
  const zonaEnvio = obterZonaPortesPorPais(regiao);
  const tabela = TABELA_PORTES_POR_PESO[zonaEnvio] || TABELA_PORTES_POR_PESO.portugal;
  const escalao = tabela.find((linha) => pesoTotal <= linha.ate) || tabela[tabela.length - 1];
  return escalao.opcoes;
}

function obterOpcaoEnvio(regiao: string, pesoTotal: number, metodoEnvio: string) {
  const opcoes = obterOpcoesEnvio(regiao, pesoTotal);
  const opcao = opcoes.find((item) => item.id === metodoEnvio) || opcoes[0];
  if (!opcao) {
    throw new Error("Nao foi possivel calcular os portes.");
  }
  return opcao;
}

function valorPortesComIva(valorBase: number) {
  return Math.round(Number(valorBase || 0) * 100) / 100;
}

function formatarEuroTexto(valor: number) {
  return Number(valor || 0).toFixed(2).replace(".", ",") + " \u20ac";
}

function formatarProdutoCliente(item: {
  quantidade: number;
  nome: string;
  preco_unitario: number;
}) {
  const quantidade = String(item.quantidade).padEnd(4, " ");
  const nome = String(item.nome || "").padEnd(26, " ");
  const preco = formatarEuroTexto(item.preco_unitario).padStart(8, " ");
  return `${quantidade}${nome}${preco}`;
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function gerarTabelaProdutosCliente(produtos: Array<{
  quantidade: number;
  nome: string;
  preco_unitario: number;
}>) {
  const linhas = produtos
    .map((item) => `
      <tr>
        <td style="padding: 1px 14px 1px 0; text-align: left;">${item.quantidade}</td>
        <td style="padding: 1px 24px 1px 0; text-align: left;">${escaparHtml(item.nome)}</td>
        <td style="padding: 1px 0; text-align: right; white-space: nowrap;">${formatarEuroTexto(item.preco_unitario)}</td>
      </tr>`)
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.35;">
    <tbody>${linhas}
    </tbody>
  </table>`;
}

function gerarCodigoEncomenda() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const codigo = Array.from(bytes)
    .map((byte) => alfabeto[byte % alfabeto.length])
    .join("");
  return codigo;
}

function respostaJson(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizarItens(itens: ItemPedido[]) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Carrinho vazio.");
  }

  const quantidadesPorProduto = new Map<string, ItemPedido>();

  itens.forEach((item) => {
    const quantidade = Number(item.quantidade || 0);
    if (!item.id_produto || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
      throw new Error("Carrinho invalido.");
    }

    const chave = String(item.id_produto);
    const quantidadeAcumulada = Number(quantidadesPorProduto.get(chave)?.quantidade || 0) + quantidade;
    if (quantidadeAcumulada > 99) {
      throw new Error("Carrinho invalido.");
    }

    quantidadesPorProduto.set(chave, {
      id_produto: item.id_produto,
      quantidade: quantidadeAcumulada,
    });
  });

  return Array.from(quantidadesPorProduto.values());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return respostaJson(req, 405, { error: "Metodo nao permitido." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return respostaJson(req, 500, { error: "Configuracao Supabase incompleta." });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return respostaJson(req, 401, { error: "Sessao em falta." });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      return respostaJson(req, 401, { error: "Sessao invalida." });
    }

    if (!user.email_confirmed_at) {
      return respostaJson(req, 403, { error: "Confirme o e-mail antes de finalizar a encomenda." });
    }

    const { error: bloqueioErro } = await authClient.rpc("assert_cliente_pode_comprar_site");
    if (bloqueioErro) {
      return respostaJson(req, 403, {
        sucesso: false,
        error: bloqueioErro.message || "Nao e possivel concluir compras com esta conta.",
      });
    }

    const payload = await req.json();
    const itens = normalizarItens(payload.itens || []);
    const regiao = String(payload.regiao || "portugal");
    const metodoEnvio = String(payload.metodo_envio || "");
    const metodoPagamento = String(payload.metodo_pagamento || "Nao especificado");
    const produtoIds = [...new Set(itens.map((item) => item.id_produto))];
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await carregarTabelaPortesRemota(adminClient);

    const { data: clienteData } = await adminClient
      .from("clientes")
      .select("nome, email, telemovel, morada, cp, cidade, pais")
      .eq("id", user.id)
      .maybeSingle();
    const cliente = clienteData as Cliente | null;

    const nomeCliente =
      cliente?.nome ||
      String(user.user_metadata?.nome || user.user_metadata?.name || "").trim() ||
      "";
    const emailCliente = cliente?.email || user.email || "";

    const { data: produtos, error: produtosError } = await adminClient
      .from("produtos")
      .select("id, sku, nome, preco, peso, stock, ativo")
      .in("id", produtoIds);

    if (produtosError) {
      throw produtosError;
    }

    const mapaProdutos = new Map((produtos || []).map((produto: Produto) => [String(produto.id), produto]));
    if (mapaProdutos.size !== produtoIds.length) {
      return respostaJson(req, 400, { error: "Um ou mais produtos ja nao estao disponiveis." });
    }

    const produtosEncomenda = itens.map((item) => {
      const produto = mapaProdutos.get(String(item.id_produto)) as Produto;
      const precoUnitario = Number(produto.preco || 0);
      const pesoUnitario = Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS);
      return {
        id_produto: produto.id,
        sku: produto.sku || "",
        nome: produto.nome,
        preco_unitario: precoUnitario,
        peso_unitario: pesoUnitario,
        quantidade: item.quantidade,
        subtotal: precoUnitario * item.quantidade,
      };
    });

    const subtotal = produtosEncomenda.reduce((total, item) => total + item.subtotal, 0);
    const pesoTotal = produtosEncomenda.reduce(
      (total, item) => total + (item.peso_unitario * item.quantidade),
      0,
    );
    const opcaoEnvio = obterOpcaoEnvio(regiao, pesoTotal, metodoEnvio);
    const portes = valorPortesComIva(opcaoEnvio.valor);
    const total = subtotal + portes;
    const produtosTexto = produtosEncomenda
      .map((item) => `${item.quantidade}\t${item.nome}\t${item.sku}`)
      .join("\n");
    const produtosTextoCliente = produtosEncomenda
      .map(formatarProdutoCliente)
      .join("\n");
    const produtosHtmlCliente = gerarTabelaProdutosCliente(produtosEncomenda);
    const codigoEncomenda = gerarCodigoEncomenda();

    const dadosEncomenda = {
      codigo_encomenda: codigoEncomenda,
      id_cliente: user.id,
      nome_cliente: nomeCliente,
      email_cliente: emailCliente,
      telefone_cliente: cliente?.telemovel || "",
      morada_cliente: cliente?.morada || "",
      cp_cliente: cliente?.cp || "",
      cidade_cliente: cliente?.cidade || "",
      pais_cliente: cliente?.pais || "",
      produtos: produtosEncomenda,
      produtos_texto: produtosTexto,
      produtos_texto_cliente: produtosTextoCliente,
      produtos_html_cliente: produtosHtmlCliente,
      regiao_envio: regiao,
      metodo_envio: opcaoEnvio.id,
      metodo_envio_nome: opcaoEnvio.nome,
      portes,
      peso_total: pesoTotal,
      total,
      metodo_pagamento: metodoPagamento,
      estado: "Pendente",
    };

    const { data: resultadoStock, error: encomendaError } = await adminClient.rpc(
      "criar_encomenda_com_stock",
      {
        p_itens: itens,
        p_encomenda: dadosEncomenda,
      },
    );

    if (encomendaError) throw encomendaError;

    if (!resultadoStock?.sucesso) {
      const produtosSemStock = Array.isArray(resultadoStock?.produtos_sem_stock)
        ? resultadoStock.produtos_sem_stock
        : [];
      const nomes = produtosSemStock
        .map((item: { nome?: string }) => String(item?.nome || "Produto indisponivel"))
        .filter(Boolean);
      const detalhe = nomes.length > 0 ? `: ${nomes.join(", ")}` : "";
      return respostaJson(req, 409, {
        error: `Stock insuficiente para os seguintes produtos${detalhe}. Atualize o carrinho e tente novamente.`,
        produtos_sem_stock: produtosSemStock,
      });
    }

    const encomenda = resultadoStock.encomenda;

    return respostaJson(req, 200, {
      sucesso: true,
      encomenda,
      subtotal,
      portes,
      metodoEnvio: opcaoEnvio.id,
      metodoEnvioNome: opcaoEnvio.nome,
      pesoTotal,
      total,
    });
  } catch (error) {
    console.error(error);
    return respostaJson(req, 400, {
      error: error instanceof Error ? error.message : "Erro ao criar encomenda.",
    });
  }
});
