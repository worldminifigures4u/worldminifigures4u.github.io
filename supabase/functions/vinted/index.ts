import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb, decodePDFRawStream } from "https://esm.sh/pdf-lib@1.17.1";

// Automação Vinted: recebe os emails da Vinted (enviados pelo script do Gmail) e aplica as regras
// (função public.vinted_processar_email). Com "simular": true nada fica gravado nas encomendas.
//  - "Vendeste um artigo na Vinted": 1 artigo -> cria a encomenda (Pago); lote -> espera pelo email da etiqueta.
//  - "Etiqueta de envio ...": cria/liga a encomenda (títulos + ID do pedido) e anexa o PDF da etiqueta.
//  - "Este pedido está concluído": só fica registado.
// Número de membro do comprador: encomendas anteriores, ou a pesquisa pública de membros da Vinted (sem login).
// País: página pública do perfil, só quando a ficha do cliente não o tem.
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const BUCKET = "anexos-encomendas";

function resp(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

async function autorizado(req: Request): Promise<boolean> {
  const segredo = req.headers.get("x-wp-segredo") || "";
  if (segredo.length < 20) return false;
  const { data } = await db.rpc("wallapop_segredo_interno");
  return typeof data === "string" && data === segredo;
}

function desescapar(t: string) {
  return String(t || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
}
function numeroEuro(t: string | undefined | null) {
  const m = String(t || "").match(/(\d+(?:[.,]\d{1,2})?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function tipoPeloAssunto(assunto: string): "venda" | "etiqueta" | "concluido" | null {
  if (/Vendeste um artigo/i.test(assunto)) return "venda";
  if (/^\s*Etiqueta de envio/i.test(assunto)) return "etiqueta";
  if (/pedido est[aá] conclu[ií]do/i.test(assunto)) return "concluido";
  return null;
}

function conversaDoEmail(html: string): string | null {
  for (const m of html.matchAll(/links\.vinted\.com\/t\/([A-Za-z0-9_\-=]+)/g)) {
    try {
      const txt = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
      const c = txt.match(/\/inbox\/([0-9a-f-]{20,})/i);
      if (c) return c[1].toLowerCase();
    } catch { /* ignora */ }
  }
  return null;
}

function lerVenda(html: string) {
  const comprador = html.match(/<strong>([^<]+)<\/strong>\s*comprou/i);
  const blocos = [...html.matchAll(/font-weight:\s*bold;\s*color:\s*#000000;?"[^>]*>([^<]+)<\/div>/gi)].map((m) => desescapar(m[1]));
  const titulo = blocos[0] || "";
  const preco = blocos.find((b) => /€/.test(b));
  const lote = titulo.match(/^Agrupar\s+(\d+)\s+artigos?$/i);
  return {
    comprador: comprador ? desescapar(comprador[1]) : null,
    n_artigos: lote ? Number(lote[1]) : 1,
    titulos: lote || !titulo ? [] : [titulo],
    total: numeroEuro(preco),
    conversa: conversaDoEmail(html),
  };
}

function lerEtiqueta(html: string) {
  const artigos = html.match(/<strong>\s*Artigo:\s*<\/strong>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const titulos = artigos ? artigos[1].split(/<br\s*\/?>/i).map((t) => desescapar(t.replace(/<[^>]+>/g, ""))).filter(Boolean) : [];
  const campo = (rotulo: string) => {
    const m = html.match(new RegExp(`<strong>\\s*${rotulo}:\\s*</strong>\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, "i"));
    return m ? desescapar(m[1].replace(/<[^>]+>/g, "")) : null;
  };
  return { titulos, pedido_id: (campo("ID do pedido") || "").replace(/\D/g, "") || null, codigo_envio: campo("Código de envio") };
}

function lerConcluido(html: string) {
  const m = desescapar(html.replace(/<[^>]+>/g, " ")).match(/ID do pedido:\s*#?(\d+)/i);
  return { pedido_id: m ? m[1] : null };
}

// Número de membro: 1) encomendas anteriores; 2) pesquisa pública de membros (só nome exato).
async function membroVinted(utilizador: string): Promise<{ membro: string | null; temporario?: boolean }> {
  const { data: conhecido } = await db.rpc("vinted_membro_conhecido", { p_utilizador: utilizador });
  if (typeof conhecido === "string" && /^\d+$/.test(conhecido)) return { membro: conhecido };
  try {
    const r = await fetch(`https://www.vinted.pt/member/general/search?search_text=${encodeURIComponent(utilizador)}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    if (!r.ok) return { membro: null, temporario: true };
    const html = await r.text();
    const pares = [...html.matchAll(/href="\/member\/(\d+)" data-testid="user-search-grid-item"[\s\S]*?data-testid="profile-username">([^<]+)</g)];
    if (!pares.length && !/user-search/.test(html)) return { membro: null, temporario: true }; // página diferente / bloqueio
    const exato = pares.filter((p) => desescapar(p[2]).toLowerCase() === utilizador.toLowerCase());
    return { membro: exato.length === 1 ? exato[0][1] : null };
  } catch {
    return { membro: null, temporario: true };
  }
}

// País do comprador (página pública do perfil, sem login). Só quando a ficha do cliente ainda não o tem.
async function paisVinted(utilizador: string, membro: string | null): Promise<string | null> {
  if (!membro) return null;
  const { data: conhecido } = await db.rpc("vinted_pais_conhecido", { p_utilizador: utilizador, p_membro: membro });
  if (typeof conhecido === "string" && conhecido.trim()) return null; // já tem país: não mexe
  try {
    const r = await fetch(`https://www.vinted.pt/member/${encodeURIComponent(membro)}`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/country_title(?:_local)?\\?"\s*:\s*\\?"([^"\\]+)/);
    const pais = m ? desescapar(m[1]) : "";
    return pais && pais.length <= 40 ? pais : null;
  } catch {
    return null;
  }
}

function limparNome(nome: string) {
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\/:*?"<>|#]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(String(b64 || "").replace(/^data:[^,]*,/, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Etiqueta compacta, igual à da extensão: transportadora + nome (negrito) por cima, QR (180 pt) e o código por baixo,
// no canto superior esquerdo de uma página A4. O QR e o código são recortados do próprio PDF da Vinted.
// Devolve null se não encontrar o QR (aí anexa-se o PDF original).
async function compactarEtiqueta(original: Uint8Array, nome: string, transportadora: string): Promise<Uint8Array | null> {
  try {
    const fonte = await PDFDocument.load(original);
    const pag = fonte.getPage(0);
    const res: any = pag.node.Resources();
    const xobjs: any = res?.lookup(PDFName.of("XObject"));
    if (!xobjs) return null;
    // Imagem do QR: quadrada, a preto e branco (1 bit).
    const qrNomes = new Set<string>();
    for (const [chave, ref] of xobjs.entries()) {
      const obj: any = fonte.context.lookup(ref);
      const dict = obj?.dict;
      if (!dict) continue;
      if (String(dict.get(PDFName.of("Subtype"))) !== "/Image") continue;
      const w = Number(dict.get(PDFName.of("Width"))?.asNumber?.() ?? 0), h = Number(dict.get(PDFName.of("Height"))?.asNumber?.() ?? 0);
      const bpc = Number(dict.get(PDFName.of("BitsPerComponent"))?.asNumber?.() ?? 0);
      if (w > 50 && w === h && bpc === 1) qrNomes.add(String(chave).replace(/^\//, ""));
    }
    if (!qrNomes.size) return null;
    // Onde o QR é desenhado: "L 0 0 A X Y cm /XOn Do" nos conteúdos da página.
    const conteudos: any = pag.node.Contents();
    const refs = conteudos?.asArray ? conteudos.asArray() : [conteudos];
    let texto = "";
    for (const r of refs) {
      const st: any = fonte.context.lookup(r) ?? r;
      if (st instanceof PDFRawStream) texto += new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()) + "\n";
      else if (st?.getContents) texto += new TextDecoder("latin1").decode(st.getContents()) + "\n";
    }
    let caixa: { x: number; y: number; l: number } | null = null;
    for (const m of texto.matchAll(/([\d.]+)\s+0\s+0\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+cm\s*\/(\w+)\s+Do/g)) {
      if (!qrNomes.has(m[5])) continue;
      const l = Number(m[1]);
      if (l >= 80 && Math.abs(l - Number(m[2])) < 1) { caixa = { x: Number(m[3]), y: Number(m[4]), l }; break; }
    }
    if (!caixa) return null;

    const pdf = await PDFDocument.create();
    const largura = 595, altura = 842, lado = 180, x = 24;
    const pagina = pdf.addPage([largura, altura]);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const seguro = (t: string) => Array.from(String(t || "")).map((c) => { try { negrito.encodeText(c); return c; } catch { return "?"; } }).join("");
    let topo = altura - 24;
    for (const linha of [transportadora || "Vinted Go", nome].filter(Boolean)) {
      const t = seguro(linha);
      let tamanho = 12.6;
      while (tamanho > 6 && negrito.widthOfTextAtSize(t, tamanho) > lado) tamanho -= 1;
      pagina.drawText(t, { x: x + (lado - negrito.widthOfTextAtSize(t, tamanho)) / 2, y: topo - tamanho, size: tamanho, font: negrito, color: rgb(0, 0, 0) });
      topo -= tamanho + (linha === nome ? 8 : 6);
    }
    // Recorte: o QR e, por baixo, o código (que no PDF da Vinted já vem centrado sob o QR).
    const abaixo = Math.round(caixa.l * 0.14);
    const recorte = await pdf.embedPage(pag, { left: caixa.x, bottom: caixa.y - abaixo, right: caixa.x + caixa.l, top: caixa.y + caixa.l });
    const escala = lado / caixa.l;
    pagina.drawPage(recorte, { x, y: topo - (caixa.l + abaixo) * escala, width: lado, height: (caixa.l + abaixo) * escala });
    return await pdf.save();
  } catch (_e) {
    return null;
  }
}

async function anexarEtiqueta(encomendaId: number, pdfB64: string, nome: string, transportadora = "") {
  const original = base64ParaBytes(pdfB64);
  if (original.length < 100 || String.fromCharCode(...original.slice(0, 5)) !== "%PDF-") return "pdf_invalido";
  const compacta = await compactarEtiqueta(original, nome, transportadora);
  const bytes = compacta || original;
  const pasta = String(encomendaId);
  const { data: existentes } = await db.storage.from(BUCKET).list(pasta, { limit: 1000 });
  if ((existentes || []).some((f: any) => /etiqueta/i.test(String(f?.name || "")))) return "ja_tinha";
  const aleatorio = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  const caminho = `${pasta}/${Date.now()}-${aleatorio}-Etiqueta Vinted - ${limparNome(nome) || "comprador"}.pdf`;
  const { error } = await db.storage.from(BUCKET).upload(caminho, bytes, { contentType: "application/pdf", cacheControl: "3600", upsert: false });
  if (error) return `erro: ${error.message}`;
  return compacta ? "anexada" : "anexada_original";
}

function transportadoraDoEmail(html: string) {
  if (/inpost/i.test(html)) return "InPost";
  if (/vinted\s*go/i.test(html)) return "Vinted Go";
  if (/\bctt\b/i.test(html)) return "CTT";
  if (/correos/i.test(html)) return "Correos";
  if (/mondial\s*relay/i.test(html)) return "Mondial Relay";
  return "Vinted Go";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp({ ok: false, erro: "metodo" }, 405);
  if (!(await autorizado(req))) return resp({ ok: false, erro: "nao_autorizado" }, 401);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }

  // Refazer no formato compacto uma etiqueta Vinted já anexada: {"compactar_anexo": "<id>/<ficheiro>.pdf", "nome": "...", "transportadora": "..."}
  if (corpo.compactar_anexo) {
    const caminho = String(corpo.compactar_anexo);
    if (!/^\d+\/[^/]+\.pdf$/i.test(caminho) || !/etiqueta/i.test(caminho)) return resp({ ok: false, erro: "caminho_invalido" }, 400);
    const { data: blob, error: erroDown } = await db.storage.from(BUCKET).download(caminho);
    if (erroDown || !blob) return resp({ ok: false, erro: erroDown?.message || "nao_encontrado" }, 404);
    const original = new Uint8Array(await blob.arrayBuffer());
    const compacta = await compactarEtiqueta(original, String(corpo.nome || ""), String(corpo.transportadora || ""));
    if (!compacta) return resp({ ok: false, erro: "qr_nao_encontrado" });
    if (corpo.so_testar) {
      let bin = "";
      for (let i = 0; i < compacta.length; i += 0x8000) bin += String.fromCharCode(...compacta.subarray(i, i + 0x8000));
      return resp({ ok: true, acao: "teste", pdf_base64: btoa(bin), tamanho_original: original.length, tamanho_novo: compacta.length });
    }
    const { error: erroUp } = await db.storage.from(BUCKET).upload(caminho, compacta, { contentType: "application/pdf", upsert: true });
    return resp(erroUp ? { ok: false, erro: erroUp.message } : { ok: true, acao: "compactada", tamanho_original: original.length, tamanho_novo: compacta.length });
  }

  const simular = corpo.simular !== false;
  const emails = (Array.isArray(corpo.emails) ? corpo.emails : []).slice(0, 20);
  const resultados: any[] = [];

  for (const e of emails) {
    const message_id = String(e?.message_id || "");
    const tipo = tipoPeloAssunto(String(e?.subject || ""));
    if (!message_id || !tipo) { resultados.push({ message_id, ok: true, acao: "ignorado" }); continue; }
    const html = String(e?.html || "");
    let p: any = { message_id, tipo, recebido_em: e?.date || null };
    if (tipo === "venda") {
      const v = lerVenda(html);
      if (!v.comprador) { resultados.push({ message_id, ok: false, erro: "formato_email_desconhecido" }); continue; }
      const m = await membroVinted(v.comprador);
      const antigo = e?.date && Date.now() - new Date(e.date).getTime() > 24 * 3600 * 1000;
      if (!m.membro && m.temporario && !antigo) {
        resultados.push({ message_id, ok: false, erro: "perfil_indisponivel: pesquisa Vinted falhou" });
        continue; // o script volta a tentar na próxima execução (até 24 h; depois segue sem o link)
      }
      const pais = await paisVinted(v.comprador, m.membro);
      p = { ...p, ...v, membro_id: m.membro, pais };
    } else if (tipo === "etiqueta") {
      const et = lerEtiqueta(html);
      if (!et.titulos.length) { resultados.push({ message_id, ok: false, erro: "formato_email_desconhecido" }); continue; }
      p = { ...p, ...et };
    } else {
      p = { ...p, ...lerConcluido(html) };
    }

    const { data, error } = await db.rpc("vinted_processar_email", { p, p_simular: simular });
    let etiqueta: string | null = null;
    if (!error && !simular && tipo === "etiqueta" && data?.encomenda_id && e?.pdf_base64) {
      etiqueta = await anexarEtiqueta(Number(data.encomenda_id), String(e.pdf_base64), data.comprador || data.codigo || "", transportadoraDoEmail(html));
    }
    if (error) resultados.push({ message_id, ok: false, erro: error.message });
    else resultados.push({ message_id, ok: true, simulado: simular, etiqueta, ...data });
    if (simular) {
      await db.from("vinted_simulacoes").insert({
        message_id, recebido_em: p.recebido_em, tipo, comprador: p.comprador || data?.comprador || null,
        titulos: p.titulos || [], resultado: error ? { erro: error.message } : { ...data, tinha_pdf: Boolean(e?.pdf_base64) },
      });
    }
  }
  return resp({ ok: resultados.every((r) => r.ok), simulado: simular, resultados });
});
