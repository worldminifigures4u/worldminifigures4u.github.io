import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Integração com a API pública do todocoleccion.
// Chamada pelo admin (JWT com is_admin) ou internamente com o cabeçalho x-tc-segredo (cofre da BD).
const BASE = "https://www.todocoleccion.net/app/tcolapi/1.0";
const ORIGENS = ["https://figuresplanet.com", "https://www.figuresplanet.com"];
const INTERVALO_MS = 420; // ~2,4 pedidos/s, abaixo do limite de ~10.000/h
const TEMPO_MAX_MS = 110_000;
const MAX_CICLOS = 40;

function cors(req: Request): HeadersInit {
  const o = req.headers.get("origin") || "";
  const ok = ORIGENS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tc-segredo",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function resp(req: Request, corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

async function segredoInterno(): Promise<string | null> {
  const { data } = await db.rpc("todocoleccion_segredo_interno");
  return (data as string) || null;
}

async function autorizado(req: Request): Promise<boolean> {
  const segredo = req.headers.get("x-tc-segredo");
  if (segredo) {
    const s = await segredoInterno();
    return !!s && s === segredo;
  }
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const cli = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await cli.rpc("is_admin");
  return !error && data === true;
}

// O todocoleccion devolve o stock no campo "stock " (com espaço no fim, erro deles a corrigir): ler os dois.
function stockTc(d: any): number | null {
  const v = d?.["stock"] ?? d?.["stock "];
  return v === undefined || v === null || v === "" ? null : Number(v);
}

let ultimo = 0;
async function tc(caminho: string, init: RequestInit = {}, tentativa = 0): Promise<any> {
  const espera = ultimo + INTERVALO_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimo = Date.now();
  const r = await fetch(BASE + caminho, {
    ...init,
    headers: {
      apikey: Deno.env.get("TODOCOLECCION_APIKEY")!,
      iduser: Deno.env.get("TODOCOLECCION_IDUSER")!,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let j: any = null;
  try { j = await r.json(); } catch { j = { success: false, error: `http_${r.status}` }; }
  if (j && j.error === "too_many_requests" && tentativa < 3) {
    await new Promise((r) => setTimeout(r, 10_000));
    return tc(caminho, init, tentativa + 1);
  }
  return j;
}

async function listar() {
  let start = 1, total = 0, guardados = 0, ts: number | undefined;
  const agora = new Date().toISOString();
  while (true) {
    const q = new URLSearchParams({ count: "100", start: String(start), orderby: "id_lote", order: "asc" });
    if (ts) q.set("to_timestamp", String(ts));
    const j = await tc(`/products?${q}`);
    if (!j?.success) return { ok: false, erro: j?.error, guardados };
    if (!ts) ts = j.timestamp;
    total = j.total;
    const linhas = (j.products || []).map((p: any) => ({
      id: p.id,
      referencia: p.id_product || null,
      estado: p.status,
      seccao: p.id_section,
      num_imagens: p.num_images ?? null,
      visto_em: agora,
    }));
    if (linhas.length) {
      const { error } = await db.from("todocoleccion_lotes").upsert(linhas, { onConflict: "id" });
      if (error) return { ok: false, erro: error.message, guardados };
      guardados += linhas.length;
    }
    if ((j.products || []).length < 100) break;
    start += 100;
  }
  // Todos os lotes vistos voltam a ter o detalhe lido (a lista não traz título/preço/stock).
  if (total > 0 && guardados >= total) {
    await db.from("todocoleccion_lotes").update({ detalhe_lido_em: null, erro: null }).eq("visto_em", agora);
  }
  // Lotes que já não existem no todocoleccion (apagados ou vendidos): saem da tabela,
  // só depois de uma leitura completa e se forem poucos (proteção contra falhas da API).
  let removidos = 0, aviso: string | null = null;
  if (total > 0 && guardados >= total) {
    const { data: antigos } = await db.from("todocoleccion_lotes").select("id").lt("visto_em", agora);
    const ids = (antigos || []).map((l: any) => l.id);
    if (ids.length > 50) {
      aviso = `${ids.length} lotes deixaram de aparecer; não foram removidos (confirmar manualmente).`;
    } else if (ids.length) {
      const { error } = await db.from("todocoleccion_lotes").delete().in("id", ids);
      if (!error) removidos = ids.length;
    }
  }
  return { ok: true, total, guardados, removidos, aviso };
}

async function lerDetalhes(limite: number) {
  const inicio = Date.now();
  const { data: lotes, error } = await db.from("todocoleccion_lotes")
    .select("id, referencia, titulo, emparelhamento, produto:produtos(sku)").is("detalhe_lido_em", null).is("erro", null)
    .order("id").limit(limite);
  if (error) return { ok: false, erro: error.message };
  let feitos = 0, erros = 0;
  for (const l of (lotes || []) as any[]) {
    if (Date.now() - inicio > TEMPO_MAX_MS) break;
    let ref = l.referencia as string | null;
    if (!ref) {
      ref = `TC${l.id}`;
      const s = await tc(`/products/setIdProduct`, { method: "PATCH", body: JSON.stringify({ id: l.id, id_product: ref }) });
      if (!s?.success) {
        await db.from("todocoleccion_lotes").update({ erro: `setIdProduct: ${s?.error}` }).eq("id", l.id);
        erros++; continue;
      }
      await db.from("todocoleccion_lotes").update({ referencia: ref }).eq("id", l.id);
    }
    const d = await tc(`/products/${encodeURIComponent(ref)}`);
    if (!d?.success) {
      await db.from("todocoleccion_lotes").update({ erro: `detalhe: ${d?.error}` }).eq("id", l.id);
      erros++; continue;
    }
    const campos: Record<string, unknown> = {
      titulo: d.title, preco: d.price ? Number(d.price) : null, stock: stockTc(d),
      estado: d.status ?? undefined, seccao: d.id_section ?? undefined,
      imagem: d.main_image || null, detalhe_lido_em: new Date().toISOString(),
    };
    // Título mudado no todocoleccion: volta a ser emparelhado (exceto os ignorados e os que têm
    // como referência o SKU do produto ligado — esses continuam ligados, mude o título o que mudar).
    const refIgualSku = !!ref && !!l.produto?.sku && String(ref).trim().toUpperCase() === String(l.produto.sku).trim().toUpperCase();
    if (l.titulo && String(l.titulo).trim() !== String(d.title || "").trim() && l.emparelhamento !== "ignorado" && !refIgualSku) {
      Object.assign(campos, { emparelhamento: "pendente", produto_id: null, semelhanca: null, sugestoes: [] });
    }
    await db.from("todocoleccion_lotes").update(campos).eq("id", l.id);
    feitos++;
  }
  const { count } = await db.from("todocoleccion_lotes").select("id", { count: "exact", head: true })
    .is("detalhe_lido_em", null).is("erro", null);
  return { ok: true, feitos, erros, em_falta: count ?? 0 };
}

// Apaga definitivamente UM lote no todocoleccion (só com id + referência + título confirmados).
async function apagarLote(id: number, tituloEsperado: string) {
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia, titulo").eq("id", id).maybeSingle();
  if (!l || !l.referencia) return { ok: false, erro: "lote_desconhecido" };
  const d = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!d?.success) return { ok: false, erro: `detalhe: ${d?.error}` };
  if (Number(d.id) !== id || String(d.title || "").trim() !== String(tituloEsperado || "").trim()) {
    return { ok: false, erro: "titulo_ou_id_nao_coincide", titulo_atual: d.title, id_atual: d.id };
  }
  const r = await tc(`/products/${encodeURIComponent(l.referencia)}`, { method: "DELETE" });
  if (!r?.success) return { ok: false, erro: `apagar: ${r?.error}` };
  const v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  const desapareceu = !v?.success;
  if (desapareceu) await db.from("todocoleccion_lotes").delete().eq("id", id);
  return { ok: desapareceu, apagado: id, titulo: d.title, verificacao: v?.error ?? "ainda_existe" };
}

// Troca a referência provisória (TC + nº do lote, ex. TC513084857) pelo SKU do produto ligado, nos lotes confirmados.
async function referenciasSku(limite: number) {
  const inicio = Date.now();
  const { data: lotes, error } = await db.from("todocoleccion_lotes")
    .select("id, referencia, produto:produtos(sku)")
    .eq("emparelhamento", "confirmado").filter("referencia", "match", "^TC[0-9]{8,}$").is("erro", null)
    .order("id").limit(limite);
  if (error) return { ok: false, erro: error.message };
  let feitos = 0, erros = 0;
  for (const l of (lotes || []) as any[]) {
    if (Date.now() - inicio > TEMPO_MAX_MS) break;
    const sku = String(l.produto?.sku || "").trim().toUpperCase();
    if (!sku) { await db.from("todocoleccion_lotes").update({ erro: "sem_sku" }).eq("id", l.id); erros++; continue; }
    const s = await tc(`/products/setIdProduct`, { method: "PATCH", body: JSON.stringify({ id: l.id, id_product: sku }) });
    if (!s?.success) {
      await db.from("todocoleccion_lotes").update({ erro: `referencia_sku: ${s?.error}` }).eq("id", l.id);
      erros++; continue;
    }
    await db.from("todocoleccion_lotes").update({ referencia: sku }).eq("id", l.id);
    feitos++;
  }
  const { count } = await db.from("todocoleccion_lotes").select("id", { count: "exact", head: true })
    .eq("emparelhamento", "confirmado").filter("referencia", "match", "^TC[0-9]{8,}$").is("erro", null);
  return { ok: true, feitos, erros, em_falta: count ?? 0 };
}

// Muda o stock de UM lote e volta a lê-lo para confirmar.
async function definirStock(id: number, stock: number) {
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, erro: "stock_invalido" };
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia").eq("id", id).maybeSingle();
  if (!l?.referencia) return { ok: false, erro: "lote_desconhecido" };
  const antes = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!antes?.success || Number(antes.id) !== id) return { ok: false, erro: `detalhe: ${antes?.error || "id_nao_coincide"}` };
  const r = await tc(`/products/${encodeURIComponent(l.referencia)}`, { method: "PATCH", body: JSON.stringify({ stock }) });
  const depois = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (depois?.success) {
    await db.from("todocoleccion_lotes").update({ stock: stockTc(depois), estado: depois.status ?? undefined }).eq("id", id);
  }
  return {
    ok: !!r?.stock_results?.success,
    resposta: r?.stock_results ?? r,
    antes: { stock: stockTc(antes), estado: antes.status },
    depois: { stock: stockTc(depois), estado: depois?.status },
  };
}

// Volta a pôr UM lote à venda (ou retira-o) e confirma o estado no todocoleccion.
async function estadoLote(id: number, acao: "activate" | "remove") {
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia").eq("id", id).maybeSingle();
  if (!l?.referencia) return { ok: false, erro: "lote_desconhecido" };
  const antes = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!antes?.success || Number(antes.id) !== id) return { ok: false, erro: `detalhe: ${antes?.error || "id_nao_coincide"}` };
  const r = await tc(`/products/${encodeURIComponent(l.referencia)}`, { method: "PATCH", body: JSON.stringify({ status: [acao] }) });
  const depois = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (depois?.success) await db.from("todocoleccion_lotes").update({ estado: depois.status }).eq("id", id);
  return { ok: !!r?.status_results?.[0]?.success, resposta: r?.status_results ?? r, estado_antes: antes.status, estado_depois: depois?.status, titulo: antes.title };
}

// O todocoleccion só aceita JPG: no Cloudinary basta mudar a extensão para receber a mesma foto em JPG.
function imagemTc(url: string) {
  return /res\.cloudinary\.com\//.test(url) ? url.replace(/\.(png|webp|gif|avif)(\?.*)?$/i, ".jpg$2") : url;
}
function imagensProdutoTc(imagens: any[] | null) {
  return ((imagens || []) as any[]).map((i) => (typeof i === "string" ? i : (i?.url || i?.src || ""))).filter(Boolean).map(imagemTc);
}

// Cria UM lote novo a partir de um produto do catálogo, copiando secção/descrição/estado de um lote modelo.
async function criarLote(produtoId: number, titulo: string, preco: number, modeloRef: string) {
  if (!produtoId || !titulo || !(preco > 0) || !modeloRef) return { ok: false, erro: "dados_em_falta" };
  const { data: p } = await db.from("produtos").select("id, sku, imagens").eq("id", produtoId).maybeSingle();
  if (!p?.sku) return { ok: false, erro: "produto_sem_sku" };
  const sku = String(p.sku).trim().toUpperCase();
  const existe = await tc(`/products/${encodeURIComponent(sku)}`);
  if (existe?.success) return { ok: false, erro: "ja_existe_lote_com_esta_referencia", id: existe.id };
  const m = await tc(`/products/${encodeURIComponent(modeloRef)}`);
  if (!m?.success) return { ok: false, erro: `modelo: ${m?.error}` };
  const imagens = imagensProdutoTc(p.imagens);
  const corpo: Record<string, unknown> = {
    id_product: sku,
    title: titulo,
    id_section: m.id_section,
    price: preco.toFixed(2),
    description_item: DESCRICAO_NOVA,
    condition: m.condition || 5,
    shipping_type: 3,
  };
  if (m.condition_details) corpo.condition_details = m.condition_details;
  if (imagens[0]) corpo.main_image = imagens[0];
  if (imagens.length > 1) corpo.extra_images = imagens.slice(1, 30);
  const r = await tc(`/products`, { method: "POST", body: JSON.stringify(corpo) });
  if (!r?.success && !r?.id) return { ok: false, erro: `criar: ${r?.error}`, resposta: r };
  const d = await tc(`/products/${encodeURIComponent(sku)}`);
  if (d?.success) {
    await db.from("todocoleccion_lotes").upsert({
      id: d.id, referencia: sku, titulo: d.title, preco: d.price ? Number(d.price) : null, stock: stockTc(d),
      estado: d.status, seccao: d.id_section, imagem: d.main_image || null, num_imagens: (d.images_list || []).length,
      produto_id: produtoId, emparelhamento: "confirmado", detalhe_lido_em: new Date().toISOString(), visto_em: new Date().toISOString(),
      descricao_versao: DESCRICAO_VERSAO,
    }, { onConflict: "id" });
  }
  return { ok: !!d?.success, id: d?.id ?? r?.id, titulo: d?.title, preco: d?.price, estado: d?.status, seccao: d?.id_section,
           imagens: (d?.images_list || []).length, portes: d?.shipping_config ?? null, resposta: r?.data ?? null };
}

// Muda só o PREÇO de UM lote. A API não tem PATCH de preço: faz PUT com os restantes dados copiados do lote
// (fotos e portes não são enviados, por isso não mudam). Confirma depois que título/fotos/portes ficaram iguais.
async function precoLote(id: number, novo: number) {
  if (!(novo > 0)) return { ok: false, erro: "preco_invalido" };
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia").eq("id", id).maybeSingle();
  if (!l?.referencia) return { ok: false, erro: "lote_desconhecido" };
  const d = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!d?.success || Number(d.id) !== id) return { ok: false, erro: `detalhe: ${d?.error || "id_nao_coincide"}` };
  const antes = { titulo: d.title, preco: d.price, imagens: (d.images_list || []).length, portes: JSON.stringify(d.shipping_config ?? null), estado: d.status };
  if (Number(d.price) === Number(novo.toFixed(2))) return { ok: true, sem_alteracao: true, antes };
  const corpo: Record<string, unknown> = {
    id_product: l.referencia,
    title: d.title,
    id_section: d.id_section,
    price: novo.toFixed(2),
    description_item: d.description || d.description_plain || "",
    condition: d.condition || 5,
  };
  if (d.condition_details) corpo.condition_details = d.condition_details;
  if (d.observations) corpo.observations = d.observations;
  const r = await tc(`/products`, { method: "PUT", body: JSON.stringify(corpo) });
  if (!r?.success) return { ok: false, erro: `put: ${r?.error}`, antes };
  const v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  const depois = { titulo: v?.title, preco: v?.price, imagens: (v?.images_list || []).length, portes: JSON.stringify(v?.shipping_config ?? null), estado: v?.status };
  if (v?.success) await db.from("todocoleccion_lotes").update({ preco: Number(v.price) }).eq("id", id);
  const igual = depois.titulo === antes.titulo && depois.imagens === antes.imagens && depois.portes === antes.portes && depois.estado === antes.estado;
  return { ok: Number(v?.price) === Number(novo.toFixed(2)) && igual, antes, depois, descricao_igual: (v?.description || "") === (d.description || "") };
}

// Substitui TODAS as fotos de UM lote pelas fotos atuais do produto no site (PATCH: apaga as antigas e põe as novas
// no mesmo pedido). Confirma depois que título/preço/portes/estado/stock ficaram iguais.
async function fotosLote(id: number) {
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia, produto_id").eq("id", id).maybeSingle();
  if (!l?.referencia || !l.produto_id) return { ok: false, erro: "lote_desconhecido" };
  const ref = encodeURIComponent(l.referencia);
  const d = await tc(`/products/${ref}`);
  if (!d?.success || Number(d.id) !== id) return { ok: false, erro: `detalhe: ${d?.error || "id_nao_coincide"}` };
  const { data: p } = await db.from("produtos").select("imagens").eq("id", l.produto_id).maybeSingle();
  const imagens = imagensProdutoTc(p?.imagens);
  if (!imagens.length) return { ok: false, erro: "produto_sem_fotos" };
  const antes = { titulo: d.title, preco: d.price, portes: JSON.stringify(d.shipping_config ?? null), estado: d.status, stock: stockTc(d),
    imagens: (d.images_list || []).length };
  const idsAtuais = ((d.images_list || []) as any[]).map((x: any, i: number) => Number(x?.id_photo ?? x?.id ?? i)).filter((n) => Number.isFinite(n));
  const corpo: Record<string, unknown> = { main_image: imagens[0] };
  if (idsAtuais.length) corpo.delete_images = idsAtuais;
  if (imagens.length > 1) corpo.extra_images = imagens.slice(1, 30);
  const r = await tc(`/products/${ref}`, { method: "PATCH", body: JSON.stringify(corpo) });
  const v = await tc(`/products/${ref}`);
  const n = (v?.images_list || []).length;
  const depois = { titulo: v?.title, preco: v?.price, portes: JSON.stringify(v?.shipping_config ?? null), estado: v?.status, stock: stockTc(v), imagens: n };
  if (v?.success) await db.from("todocoleccion_lotes").update({ num_imagens: n, imagem: v.main_image || null }).eq("id", Number(v.id));
  const igual = depois.titulo === antes.titulo && Number(depois.preco) === Number(antes.preco) && depois.portes === antes.portes
    && depois.estado === antes.estado && depois.stock === antes.stock;
  return { ok: n === Math.min(imagens.length, 30) && igual, enviadas: Math.min(imagens.length, 30), antes, depois, resposta: r };
}

// Stock do site manda: o lote no todocoleccion tem o mesmo nº de unidades que o site,
// e só está à venda com stock > 0. Se o todocoleccion tiver republicado o lote com outro número
// (depois de uma venda ou ao reativar), a tabela passa a usar o lote novo.
async function lotePassaPara(idVelho: number, d: any, ref: string) {
  const { data: velho } = await db.from("todocoleccion_lotes").select("produto_id").eq("id", idVelho).maybeSingle();
  await db.from("todocoleccion_lotes").upsert({
    id: d.id, referencia: ref, titulo: d.title, preco: d.price ? Number(d.price) : null, stock: stockTc(d),
    estado: d.status, seccao: d.id_section, imagem: d.main_image || null, num_imagens: (d.images_list || []).length,
    produto_id: velho?.produto_id ?? null, emparelhamento: "confirmado", detalhe_lido_em: new Date().toISOString(), visto_em: new Date().toISOString(),
  }, { onConflict: "id" });
  await db.from("todocoleccion_lotes").delete().eq("id", idVelho);
}

async function sincronizarEstado(produtos: number[] | null, corpo: any = {}) {
  const inicio = Date.now();
  const { data, error } = await db.rpc("todocoleccion_lotes_sincronizar_v2", { p_produtos: produtos && produtos.length ? produtos : null });
  if (error) return { ok: false, erro: error.message };
  let stocks = 0, retirados = 0, reativados = 0, mudaramNumero = 0, porFazer = 0;
  const falhas: any[] = [];
  for (const it of (data || []) as any[]) {
    if (Date.now() - inicio > TEMPO_MAX_MS) { porFazer++; continue; }
    const id = Number(it.id), ref = String(it.referencia), alvo = Number(it.alvo);
    let d = await tc(`/products/${encodeURIComponent(ref)}`);
    if (!d?.success) { falhas.push({ id, ref, erro: `detalhe: ${d?.error}` }); continue; }
    if (Number(d.id) !== id) { await lotePassaPara(id, d, ref); mudaramNumero++; porFazer++; continue; }
    // 1) unidades
    if (stockTc(d) !== alvo) {
      const r = await tc(`/products/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify({ stock: alvo }) });
      if (!r?.stock_results?.success) { falhas.push({ id, ref, erro: "stock", resposta: r?.stock_results ?? r }); continue; }
      stocks++;
      d = await tc(`/products/${encodeURIComponent(ref)}`);
      if (!d?.success) { falhas.push({ id, ref, erro: `detalhe: ${d?.error}` }); continue; }
    }
    await db.from("todocoleccion_lotes").update({ stock: stockTc(d) ?? alvo, estado: d.status }).eq("id", id);
    // 2) à venda ou retirado
    if (alvo <= 0 && d.status === 0) {
      await tc(`/products/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify({ status: ["remove"] }) });
      const v = await tc(`/products/${encodeURIComponent(ref)}`);
      if (v?.success) await db.from("todocoleccion_lotes").update({ estado: v.status }).eq("id", id);
      if (v?.success && v.status !== 0) retirados++; else falhas.push({ id, ref, erro: "retirar" });
    } else if (alvo > 0 && d.status !== 0) {
      await tc(`/products/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify({ status: ["activate"] }) });
      let v = await tc(`/products/${encodeURIComponent(ref)}`);
      if (v?.success && Number(v.id) !== id) {
        // Reativar criou um lote novo: passa a ser esse, com as unidades certas e à venda.
        await lotePassaPara(id, v, ref); mudaramNumero++;
        if (stockTc(v) !== alvo) await tc(`/products/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify({ stock: alvo }) });
        if (v.status !== 0) await tc(`/products/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify({ status: ["activate"] }) });
        v = await tc(`/products/${encodeURIComponent(ref)}`);
        if (v?.success) await db.from("todocoleccion_lotes").update({ stock: stockTc(v), estado: v.status }).eq("id", v.id);
      } else if (v?.success) {
        await db.from("todocoleccion_lotes").update({ estado: v.status }).eq("id", id);
      }
      if (v?.success && v.status === 0) reativados++; else falhas.push({ id, ref, erro: `ativar: estado_${v?.status}` });
    }
  }
  // Ficou trabalho por fazer (tempo ou lotes que mudaram de número): continua noutra execução.
  if (porFazer > 0 && corpo.continuar !== false && (Number(corpo.ciclo) || 0) < MAX_CICLOS) {
    await encadear({ acao: "sincronizar_estado", produtos, ciclo: corpo.ciclo, continuar: true });
  }
  return { ok: falhas.length === 0, total: (data || []).length, stocks, retirados, reativados, mudaram_numero: mudaramNumero, por_fazer: porFazer, falhas };
}

// ---------- Encomendas do todocoleccion ----------
const PAISES: Record<string, [string, string]> = {
  "España": ["Espanha", "espanha"], "Portugal": ["Portugal", "portugal"], "Francia": ["França", "franca"],
  "Alemania": ["Alemanha", "alemanha"], "Italia": ["Itália", "italia"], "Países Bajos": ["Países Baixos", "paises_baixos"],
  "Bélgica": ["Bélgica", "belgica"], "Reino Unido": ["Reino Unido", "reino_unido"], "Irlanda": ["Irlanda", "irlanda"],
};

async function encomendasTc(max = 300) {
  const out: any[] = [];
  for (let start = 1; out.length < max; start += 50) {
    const j = await tc(`/orders?count=50&start=${start}`);
    if (!j?.success) return { ok: false, erro: j?.error, orders: out };
    const o = j.orders || [];
    out.push(...o);
    if (o.length < 50) break;
  }
  return { ok: true, orders: out };
}

// Depois de uma venda o todocoleccion volta a publicar o lote com outro número (retirado).
// Liga esse lote novo ao produto e apaga o vendido da tabela (o estado certo vem da sincronização de stock).
async function religarLoteVendido(loteId: number, ref: string, produtoId: number) {
  await db.from("todocoleccion_lotes").delete().eq("id", loteId);
  if (!ref) return null;
  const d = await tc(`/products/${encodeURIComponent(ref)}`);
  if (!d?.success || Number(d.id) === loteId) return null;
  await db.from("todocoleccion_lotes").upsert({
    id: d.id, referencia: ref, titulo: d.title, preco: d.price ? Number(d.price) : null, stock: stockTc(d),
    estado: d.status, seccao: d.id_section, imagem: d.main_image || null, num_imagens: (d.images_list || []).length,
    produto_id: produtoId, emparelhamento: "confirmado", detalhe_lido_em: new Date().toISOString(), visto_em: new Date().toISOString(),
  }, { onConflict: "id" });
  return d.id;
}

async function produtoDoLote(loteId: number, ref: string): Promise<number | null> {
  const { data: l } = await db.from("todocoleccion_lotes").select("produto_id").eq("id", loteId).eq("emparelhamento", "confirmado").maybeSingle();
  if (l?.produto_id) return Number(l.produto_id);
  if (ref) {
    const { data: p } = await db.from("produtos").select("id").eq("sku", ref).limit(1).maybeSingle();
    if (p?.id) return Number(p.id);
    const { data: p2 } = await db.from("produtos").select("id").ilike("sku", ref).limit(1).maybeSingle();
    if (p2?.id) return Number(p2.id);
  }
  return null;
}

// modo "base": marca todas as encomendas que já existem como já registadas (sem importar), ligando-as às do admin.
// modo normal: importa as novas, e passa a "Pago" as que entretanto foram pagas no todocoleccion.
async function importarEncomendas(modo: string) {
  const inicio = Date.now();
  const lista = await encomendasTc(modo === "base" ? 1000 : 100);
  if (!lista.ok) return { ok: false, erro: lista.erro };
  const ids = lista.orders.map((o: any) => Number(o.id_order));
  const { data: conhecidas } = await db.from("todocoleccion_encomendas").select("id_order, encomenda_id, situacao").in("id_order", ids.length ? ids : [0]);
  const mapa = new Map((conhecidas || []).map((c: any) => [Number(c.id_order), c]));
  // Encomendas do admin ainda "A aguardar pagamento": para estas lê-se o detalhe (a lista nem sempre muda de estado ao pagar).
  const idsAdmin = (conhecidas || []).map((c: any) => c.encomenda_id).filter(Boolean);
  const { data: porPagar } = await db.from("encomendas").select("id").in("id", idsAdmin.length ? idsAdmin : [0]).eq("estado", "A aguardar pagamento");
  const aguardam = new Set((porPagar || []).map((e: any) => Number(e.id)));
  const importadas: any[] = [], registadas: any[] = [], pagas: any[] = [], erros: any[] = [];

  for (const o of lista.orders) {
    const idOrder = Number(o.id_order);
    const conhecida: any = mapa.get(idOrder);
    if (conhecida) {
      // Paga no todocoleccion e ainda à espera no admin: passa a Pago, com os portes e o total finais.
      if (!o.is_anulled && conhecida.encomenda_id && aguardam.has(Number(conhecida.encomenda_id))) {
        const d = await tc(`/orders/${idOrder}`);
        const st = d?.status_order || {};
        if (st.paid === true || (o.status && o.status !== "pending")) {
          const portes = Number(d?.costs || 0);
          const total = Number(d?.price_total ?? d?.total ?? 0);
          const pais = d?.buyer?.country || "";
          const campos: Record<string, unknown> = {
            estado: "Pago",
            data_pagamento: st.paid_timestamp ? new Date(Number(st.paid_timestamp) * 1000).toISOString() : new Date().toISOString(),
          };
          if (portes > 0) {
            campos.portes = portes;
            if (total > 0) campos.total = total;
            if (pais === "España") {
              Object.assign(campos, portes >= 6.95
                ? { metodo_envio: "ctt_azul_internacional", metodo_envio_nome: "CTT Azul Internacional" }
                : { metodo_envio: "inpost_registado", metodo_envio_nome: "InPost com seguimento" });
            } else if (pais && pais !== "Portugal") {
              Object.assign(campos, { metodo_envio: "ctt_azul_internacional", metodo_envio_nome: "CTT Azul Internacional" });
            }
          }
          const { data: up } = await db.from("encomendas").update(campos)
            .eq("id", conhecida.encomenda_id).eq("estado", "A aguardar pagamento").select("codigo_encomenda");
          if (up && up.length) pagas.push({ codigo: up[0].codigo_encomenda, portes, total });
        }
      }
      await db.from("todocoleccion_encomendas").update({ estado_tc: o.status, visto_em: new Date().toISOString() }).eq("id_order", idOrder);
      continue;
    }
    if (Date.now() - inicio > TEMPO_MAX_MS) break;
    const d = await tc(`/orders/${idOrder}`);
    if (!d?.success) { erros.push({ id_order: idOrder, erro: d?.error }); continue; }
    const b = d.buyer || {};
    const itensTc = (d.products || []).map((x: any) => ({ lote: Number(x.id), ref: String(x.id_product || "").trim().toUpperCase(), preco: Number(x.price), uri: x.uri }));
    const linhaBase = { id_order: idOrder, data_encomenda: new Date(Number(d.date_order) * 1000).toISOString(), total: Number(d.price_total ?? d.total),
      comprador: b.login || b.slug || null, estado_tc: o.status, itens: itensTc };

    if (modo === "base") {
      const { data: enc } = await db.from("encomendas").select("id, referencia_externa").eq("origem", "Todocoleccion")
        .eq("perfil_externo_utilizador", b.login || b.slug || "").eq("total", Number(d.price_total ?? d.total)).limit(1).maybeSingle();
      if (enc?.id && !enc.referencia_externa) await db.from("encomendas").update({ referencia_externa: String(idOrder) }).eq("id", enc.id);
      await db.from("todocoleccion_encomendas").upsert({ ...linhaBase, encomenda_id: enc?.id ?? null, situacao: "ja_registada" }, { onConflict: "id_order" });
      registadas.push({ id_order: idOrder, encomenda_id: enc?.id ?? null });
      continue;
    }
    if (d.is_annulled) {
      await db.from("todocoleccion_encomendas").upsert({ ...linhaBase, situacao: "anulada" }, { onConflict: "id_order" });
      continue;
    }
    // Produtos: lote -> produto. Primeiro liga os lotes republicados, depois cria a encomenda (que desce o stock).
    const itens: any[] = [], sem: any[] = [], produtos: number[] = [];
    for (const it of itensTc) {
      const pid = await produtoDoLote(it.lote, it.ref);
      if (!pid) { sem.push({ lote: it.lote, preco: it.preco, titulo: decodeURIComponent(String(it.uri || "").split("/").pop()?.split("~")[0] || "") }); continue; }
      await religarLoteVendido(it.lote, it.ref, pid);
      itens.push({ id_produto: String(pid), preco: it.preco, lote: it.lote });
      produtos.push(pid);
    }
    const [paisPt, regiao] = PAISES[b.country] || [b.country || null, String(b.country || "todocoleccion").toLowerCase()];
    const portes = Number(d.costs || 0);
    let metodo = "todocoleccion", metodoNome = "Todocoleccion";
    if (b.country === "España") { [metodo, metodoNome] = portes >= 6.95 ? ["ctt_azul_internacional", "CTT Azul Internacional"] : ["inpost_registado", "InPost com seguimento"]; }
    else if (b.country && b.country !== "Portugal") { [metodo, metodoNome] = ["ctt_azul_internacional", "CTT Azul Internacional"]; }
    const st = d.status_order || {};
    const { data: r, error } = await db.rpc("todocoleccion_criar_encomenda", { p: {
      id_order: String(idOrder), data: linhaBase.data_encomenda, pago: !!st.paid,
      data_pagamento: st.paid_timestamp ? new Date(Number(st.paid_timestamp) * 1000).toISOString() : null,
      total: Number(d.price_total ?? d.total), portes, login: b.login || b.slug || "", perfil_url: b.slug ? `https://pt.todocoleccion.net/usuario/${b.slug}` : "",
      nome: b.name || "", email: b.email || "", telefone: b.mobile || b.phone || "", morada: b.address || "", cp: b.cp || "",
      cidade: b.city || b.locality || "", pais: paisPt, regiao_envio: regiao, metodo_envio: metodo, metodo_envio_nome: metodoNome,
      itens, sem_produto: sem } });
    if (error || !r?.sucesso) {
      await db.from("todocoleccion_encomendas").upsert({ ...linhaBase, situacao: "erro", erro: error?.message || r?.erro || "desconhecido" }, { onConflict: "id_order" });
      erros.push({ id_order: idOrder, erro: error?.message || r?.erro });
      continue;
    }
    await db.from("todocoleccion_encomendas").upsert({ ...linhaBase, situacao: "importada", encomenda_id: r.encomenda_id }, { onConflict: "id_order" });
    importadas.push({ id_order: idOrder, codigo: r.codigo, produtos: itens.length, sem_produto: sem.length });
  }
  return { ok: erros.length === 0, modo: modo || "normal", importadas, registadas: registadas.length, pagas, erros };
}

// Marca no todocoleccion UMA encomenda como enviada, com data e número de seguimento, e confirma.
async function marcarEnviada(idOrder: number, codigo: string, data: string) {
  if (!idOrder || !codigo) return { ok: false, erro: "dados_em_falta" };
  const dt = /^\d{2}\/\d{2}\/\d{4}$/.test(data || "") ? data
    : new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  // Já marcada como enviada no todocoleccion (à mão ou por Envíos TC): não mexe.
  const a = await tc(`/orders/${idOrder}`);
  if (!a?.success && !a?.status_order) return { ok: false, erro: `detalhe: ${a?.error}` };
  if (a?.status_order?.sent === true) {
    await db.from("todocoleccion_encomendas").update({ enviada_tc_em: new Date().toISOString(), envio_tc_erro: null }).eq("id_order", idOrder);
    return { ok: true, ja_estava_enviada: true, codigo_tc: a.status_order.shipping_way ?? null };
  }
  const r = await tc(`/orders/${idOrder}`, { method: "PATCH", body: JSON.stringify({ order_status: { sent: true, sent_date: dt, shipping_code: codigo } }) });
  const v = await tc(`/orders/${idOrder}`);
  const st = v?.status_order || {};
  const ok = st.sent === true && String(st.shipping_way || "").trim() === codigo;
  await db.from("todocoleccion_encomendas").update({ enviada_tc_em: ok ? new Date().toISOString() : null, envio_tc_erro: ok ? null : JSON.stringify(r).slice(0, 500) }).eq("id_order", idOrder);
  return { ok, data: dt, resposta: r, estado: st };
}

// ---------- Descrição dos lotes ----------
const DESCRICAO_VERSAO = "es-2026-10e";
const LINHA_PORTES = "<p>\u27a4 Envío a <strong>España</strong> peninsular: <strong>4,95 €</strong>, da igual cuántas figuras compre</p>";
const LINHA_PORTES_ARTIGO = "<p>\u27a4 Envío a <strong>España</strong> peninsular: <strong>4,95 €</strong>, da igual cuántos artículos compre</p>";
const LINHA_ENVIO = "<p>\u2709\ufe0f Envío desde Portugal con seguimiento. Puede comprar varios lotes y pagar un solo envío. España peninsular: InPost a punto de recogida. Envío a domicilio y resto de Europa por CTT según el peso. Tras la compra le indicaré los gastos de envío antes del pago.</p>";
const DESCRICAO_NOVA = LINHA_PORTES +
  "<p>✨ Minifigura nueva. La gran mayoría se envían en su bolsa original precintada de fábrica; algunas figuras personalizadas, aunque nuevas, se envían sin bolsa precintada.</p>" +
  "<p>ℹ️ Las figuras no son de la marca LEGO®. Son de otras marcas, pero compatibles con LEGO® y con las mismas dimensiones.</p>" +
  "<p>✔️ Recibirá la figura tal y como aparece en las fotos, con todos sus accesorios. Solo la base puede ser diferente.</p>" +
  LINHA_ENVIO;
const INICIO_NOVO = "Envío a España peninsular: 4,95 €, da igual cuánt";
// Descrição antiga "normal" (só estes lotes são mudados; os diferentes ficam como estão e são listados).
const DESCRICAO_ANTIGA = "Consulte todas as figuras deste tema em \"Ver todos os seus lotes nesta secção\".As figuras não são marca lego mas são compatíveis e com as mesmas dimensões.A base das figuras pode ser diferente da apresentada na foto.";
// Para artigos que não são figuras (veículos, carroças...).
const DESCRICAO_ARTIGO = LINHA_PORTES_ARTIGO +
  "<p>\u2728 Artículo nuevo.</p>" +
  "<p>\u2139\ufe0f No es de la marca LEGO®. Es de otra marca, pero compatible con LEGO®.</p>" +
  "<p>\u2714\ufe0f Recibirá el artículo tal y como aparece en las fotos.</p>" +
  LINHA_ENVIO;
const normTexto = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

async function descricaoLote(id: number, forcar = false, artigo = false) {
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia").eq("id", id).maybeSingle();
  if (!l?.referencia) return { ok: false, erro: "lote_desconhecido" };
  const d = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!d?.success || Number(d.id) !== id) return { ok: false, erro: `detalhe: ${d?.error || "id_nao_coincide"}` };
  const atual = normTexto(d.description_plain || d.description || "");
  // Veículos e outros artigos: detetados pelo texto atual.
  if (atual.includes(normTexto("Artículo nuevo"))) artigo = true;
  const html = artigo ? DESCRICAO_ARTIGO : DESCRICAO_NOVA;
  const inicioTexto = artigo ? "Artículo nuevo" : "Minifigura nueva. La gran mayoría";
  if (!forcar && atual.startsWith(normTexto(INICIO_NOVO)) && atual.includes(normTexto(inicioTexto))) {
    await db.from("todocoleccion_lotes").update({ descricao_versao: DESCRICAO_VERSAO }).eq("id", id);
    return { ok: true, sem_alteracao: true };
  }
  const jaTextoNovo = atual.startsWith(normTexto("Minifigura nueva")) || atual.startsWith(normTexto("Artículo nuevo"))
    || atual.startsWith(normTexto("Envío a España peninsular"));
  // Variantes da descrição antiga em português (todas começam por "Consulte todas as figuras" e têm o aviso da marca).
  const antigaPt = atual === normTexto(DESCRICAO_ANTIGA) || (atual.startsWith(normTexto("Consulte todas as figuras")) && atual.includes(normTexto("As figuras não são marca lego")));
  if (!forcar && !jaTextoNovo && !antigaPt) {
    await db.from("todocoleccion_lotes").update({ descricao_versao: "diferente" }).eq("id", id);
    return { ok: false, erro: "descricao_diferente", titulo: d.title, descricao: String(d.description_plain || "").slice(0, 200) };
  }
  const antes = { titulo: d.title, preco: d.price, imagens: (d.images_list || []).length, portes: JSON.stringify(d.shipping_config ?? null), estado: d.status, stock: stockTc(d) };
  const corpo: Record<string, unknown> = {
    id_product: l.referencia, title: d.title, id_section: d.id_section, price: Number(d.price).toFixed(2),
    description_item: html, condition: d.condition || 5,
  };
  if (d.condition_details) corpo.condition_details = d.condition_details;
  if (d.observations) corpo.observations = d.observations;
  const r = await tc(`/products`, { method: "PUT", body: JSON.stringify(corpo) });
  if (!r?.success) return { ok: false, erro: `put: ${r?.error}`, antes };
  let v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  // Se o PUT mexer nas unidades, repõe-as.
  if (v?.success && antes.stock !== null && stockTc(v) !== antes.stock) {
    await tc(`/products/${encodeURIComponent(l.referencia)}`, { method: "PATCH", body: JSON.stringify({ stock: antes.stock }) });
    v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  }
  const depois = { titulo: v?.title, preco: v?.price, imagens: (v?.images_list || []).length, portes: JSON.stringify(v?.shipping_config ?? null), estado: v?.status, stock: stockTc(v) };
  const igual = depois.titulo === antes.titulo && Number(depois.preco) === Number(antes.preco) && depois.imagens === antes.imagens
    && depois.portes === antes.portes && depois.estado === antes.estado && depois.stock === antes.stock;
  const vt = normTexto(v?.description_plain || v?.description || "");
  const novaOk = vt.startsWith(normTexto(INICIO_NOVO)) && vt.includes(normTexto(inicioTexto))
    && /ℹ|&#8505;/.test(String(v?.description || ""));
  const ok = igual && novaOk;
  await db.from("todocoleccion_lotes").update({ descricao_versao: ok ? DESCRICAO_VERSAO : "erro" }).eq("id", id);
  return { ok, igual, nova_ok: novaOk, antes, depois, descricao_guardada: v?.description, descricao_texto: v?.description_plain };
}

async function descricoesLotes(corpo: any) {
  const inicio = Date.now();
  const { data: lotes, error } = await db.from("todocoleccion_lotes").select("id")
    .eq("emparelhamento", "confirmado").in("estado", [0, 4]).is("descricao_versao", null).order("id").limit(150);
  if (error) return { ok: false, erro: error.message };
  let mudados = 0, ja = 0, porFazer = 0;
  const diferentes: any[] = [], falhas: any[] = [];
  for (const l of (lotes || []) as any[]) {
    if (Date.now() - inicio > TEMPO_MAX_MS) { porFazer++; continue; }
    const r: any = await descricaoLote(Number(l.id));
    if (r.ok && r.sem_alteracao) ja++;
    else if (r.ok) mudados++;
    else if (r.erro === "descricao_diferente") diferentes.push({ id: l.id, titulo: r.titulo });
    else falhas.push({ id: l.id, erro: r.erro, igual: r.igual, nova_ok: r.nova_ok });
  }
  const { count } = await db.from("todocoleccion_lotes").select("id", { count: "exact", head: true })
    .eq("emparelhamento", "confirmado").in("estado", [0, 4]).is("descricao_versao", null);
  if ((count ?? 0) > 0 && falhas.length === 0 && corpo.continuar && (Number(corpo.ciclo) || 0) < MAX_CICLOS) await encadear(corpo);
  return { ok: falhas.length === 0, mudados, ja, diferentes, falhas, em_falta: count ?? 0 };
}

// ---------- Título dos lotes ----------
// Muda só o TÍTULO de UM lote (PUT com os restantes dados iguais) e confirma que o resto não mudou.
async function tituloLote(id: number, novo: string) {
  novo = String(novo || "").trim();
  if (novo.length < 5) return { ok: false, erro: "titulo_invalido" };
  const { data: l } = await db.from("todocoleccion_lotes").select("id, referencia").eq("id", id).maybeSingle();
  if (!l?.referencia) return { ok: false, erro: "lote_desconhecido" };
  const d = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (!d?.success || Number(d.id) !== id) return { ok: false, erro: `detalhe: ${d?.error || "id_nao_coincide"}` };
  if (String(d.title || "").trim() === novo) {
    await db.from("todocoleccion_lotes").update({ titulo: novo }).eq("id", id);
    return { ok: true, sem_alteracao: true };
  }
  const antes = { titulo: d.title, preco: d.price, imagens: (d.images_list || []).length, portes: JSON.stringify(d.shipping_config ?? null),
    estado: d.status, stock: stockTc(d), descricao: normTexto(d.description_plain || d.description || "") };
  const corpo: Record<string, unknown> = {
    id_product: l.referencia, title: novo, id_section: d.id_section, price: Number(d.price).toFixed(2),
    description_item: d.description || d.description_plain || "", condition: d.condition || 5,
  };
  if (d.condition_details) corpo.condition_details = d.condition_details;
  if (d.observations) corpo.observations = d.observations;
  const r = await tc(`/products`, { method: "PUT", body: JSON.stringify(corpo) });
  if (!r?.success) return { ok: false, erro: `put: ${r?.error}`, antes };
  let v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  if (v?.success && antes.stock !== null && stockTc(v) !== antes.stock) {
    await tc(`/products/${encodeURIComponent(l.referencia)}`, { method: "PATCH", body: JSON.stringify({ stock: antes.stock }) });
    v = await tc(`/products/${encodeURIComponent(l.referencia)}`);
  }
  const depois = { titulo: v?.title, preco: v?.price, imagens: (v?.images_list || []).length, portes: JSON.stringify(v?.shipping_config ?? null),
    estado: v?.status, stock: stockTc(v), descricao: normTexto(v?.description_plain || v?.description || "") };
  const resto = Number(depois.preco) === Number(antes.preco) && depois.imagens === antes.imagens && depois.portes === antes.portes
    && depois.estado === antes.estado && depois.stock === antes.stock && depois.descricao === antes.descricao;
  const tituloOk = String(depois.titulo || "").trim() === novo;
  if (v?.success) await db.from("todocoleccion_lotes").update({ titulo: v.title }).eq("id", id);
  return { ok: tituloOk && resto, titulo_ok: tituloOk, resto_igual: resto, antes: { ...antes, descricao: undefined }, depois: { ...depois, descricao: undefined } };
}

async function titulosLotes(corpo: any) {
  const lista = (Array.isArray(corpo.itens) ? corpo.itens : []).slice(0, 60);
  const inicio = Date.now();
  const feitos: any[] = [], falhas: any[] = [];
  let porFazer = 0;
  for (const it of lista) {
    if (Date.now() - inicio > TEMPO_MAX_MS) { porFazer++; continue; }
    const r: any = await tituloLote(Number(it.id), String(it.titulo || ""));
    (r.ok ? feitos : falhas).push({ id: it.id, titulo: it.titulo, ...(r.ok ? { sem_alteracao: !!r.sem_alteracao } : r) });
  }
  return { ok: falhas.length === 0, feitos: feitos.length, falhas, por_fazer: porFazer };
}

// Dispara o bloco seguinte através da BD (pg_net), de forma independente desta execução.
async function encadear(corpo: any) {
  await db.rpc("todocoleccion_disparar", { p_corpo: { ...corpo, ciclo: (Number(corpo.ciclo) || 0) + 1 } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return resp(req, { ok: false, erro: "metodo" }, 405);
  if (!(await autorizado(req))) return resp(req, { ok: false, erro: "nao_autorizado" }, 401);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  try {
    switch (corpo.acao) {
      case "listar": return resp(req, await listar());
      case "ler_detalhes": {
        const r: any = await lerDetalhes(Math.min(Number(corpo.limite) || 120, 200));
        if (r.ok) {
          // Em cada bloco: emparelha só os lotes novos ou com título mudado (sem limite de tempo do login).
          const e = await db.rpc("todocoleccion_emparelhar", { p_so_pendentes: true });
          r.emparelhamento = e.error ? { erro: e.error.message } : e.data;
        }
        if (corpo.continuar && r.ok && r.em_falta > 0 && r.feitos > 0 && (Number(corpo.ciclo) || 0) < MAX_CICLOS) {
          await encadear(corpo);
        } else if (corpo.continuar && r.ok && r.em_falta === 0) {
          // Fim da leitura: acerta o que está à venda com o stock do site.
          await db.rpc("todocoleccion_disparar", { p_corpo: { acao: "sincronizar_estado" } });
        }
        return resp(req, r);
      }
      case "sincronizar_estado": {
        const ids = Array.isArray(corpo.produtos) ? corpo.produtos.map(Number).filter(Boolean) : null;
        return resp(req, await sincronizarEstado(ids, corpo));
      }
      case "referencias_sku": {
        const r: any = await referenciasSku(Math.min(Number(corpo.limite) || 150, 250));
        if (corpo.continuar && r.ok && r.em_falta > 0 && r.feitos > 0 && (Number(corpo.ciclo) || 0) < MAX_CICLOS) {
          await encadear(corpo);
        }
        return resp(req, r);
      }
      case "definir_stock": return resp(req, await definirStock(Number(corpo.id), Number(corpo.stock)));
      case "ativar_lote": return resp(req, await estadoLote(Number(corpo.id), "activate"));
      case "ativar_lotes": {
        // Vários lotes, um de cada vez (respeita o limite de pedidos do todocoleccion).
        const ids = (Array.isArray(corpo.ids) ? corpo.ids : []).map(Number).filter(Boolean).slice(0, 60);
        const resultados: any[] = [];
        for (const id of ids) resultados.push({ id, ...(await estadoLote(id, "activate")) });
        return resp(req, { ok: resultados.every((r) => r.ok && r.estado_depois === 0), total: ids.length,
          a_venda: resultados.filter((r) => r.estado_depois === 0).length,
          falhas: resultados.filter((r) => !(r.ok && r.estado_depois === 0)) });
      }
      case "preco_lote": return resp(req, await precoLote(Number(corpo.id), Number(corpo.preco)));
      case "precos_lotes": {
        // [{id, preco}, ...] um de cada vez; pára no tempo limite e devolve o que falta.
        const lista = (Array.isArray(corpo.itens) ? corpo.itens : []).slice(0, 80);
        const inicio = Date.now();
        const feitos: any[] = [], falhas: any[] = [];
        for (const it of lista) {
          if (Date.now() - inicio > TEMPO_MAX_MS) break;
          const r: any = await precoLote(Number(it.id), Number(it.preco));
          (r.ok ? feitos : falhas).push({ id: it.id, preco: it.preco, ...(r.ok ? {} : r) });
        }
        return resp(req, { ok: falhas.length === 0, feitos: feitos.length, falhas, por_fazer: lista.length - feitos.length - falhas.length });
      }
      case "retirar_lote": return resp(req, await estadoLote(Number(corpo.id), "remove"));
      case "criar_lote": return resp(req, await criarLote(Number(corpo.produto_id), String(corpo.titulo || "").trim(), Number(corpo.preco), String(corpo.modelo_ref || "")));
      case "ver_refs": {
        // Só leitura: que lote o todocoleccion devolve para cada referência.
        const refs = (Array.isArray(corpo.refs) ? corpo.refs : []).map(String).slice(0, 30);
        const out: any[] = [];
        for (const ref of refs) {
          const d = await tc(`/products/${encodeURIComponent(ref)}`);
          out.push({ ref, ok: !!d?.success, id: d?.id, titulo: d?.title, preco: d?.price, estado: d?.status, stock: stockTc(d), erro: d?.error });
        }
        return resp(req, { ok: true, lotes: out });
      }
      case "ler_encomendas_api": {
        // Só leitura (GET) a /orders, para conhecer o formato das encomendas.
        const caminho = String(corpo.caminho || "/orders");
        if (!/^\/orders([\/?].*)?$/.test(caminho)) return resp(req, { ok: false, erro: "caminho_nao_permitido" }, 400);
        return resp(req, { ok: true, caminho, resposta: await tc(caminho) });
      }
      case "importar_encomendas": return resp(req, await importarEncomendas(String(corpo.modo || "")));
      case "descricao_lote": return resp(req, await descricaoLote(Number(corpo.id), !!corpo.forcar, !!corpo.artigo));
      case "descricoes_lotes": return resp(req, await descricoesLotes(corpo));
      case "titulos_lotes": return resp(req, await titulosLotes(corpo));
      case "fotos_lote": return resp(req, await fotosLote(Number(corpo.id)));
      case "marcar_enviada": return resp(req, await marcarEnviada(Number(corpo.id_order), String(corpo.codigo || "").trim(), String(corpo.data || "")));
      case "apagar_lote": return resp(req, await apagarLote(Number(corpo.id), String(corpo.titulo || "")));
      default: return resp(req, { ok: false, erro: "acao_desconhecida" }, 400);
    }
  } catch (e) {
    return resp(req, { ok: false, erro: String(e) }, 500);
  }
});
