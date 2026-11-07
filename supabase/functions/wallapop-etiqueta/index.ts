import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etiqueta de envio do Wallapop: a extensão "Assistente de Respostas" envia o PDF quando se carrega em
// "Guardar PDF Etiqueta". Esta função encontra a encomenda e junta o PDF aos anexos. Ordem de procura:
// 1) número da venda (r=... da página do envio), 2) código do lote personalizado, 3) nome do comprador
// (só se houver uma única encomenda Wallapop em Pago/Em preparação com esse nome).
// Não duplica: se a encomenda já tiver uma etiqueta anexada, não junta outra.
// O segredo (x-wp-segredo) é o mesmo do script do Gmail e fica só na extensão/script, nunca aqui.
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const BUCKET = "anexos-encomendas";
const MAX_BYTES = 10 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-wp-segredo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function resp(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function autorizado(req: Request): Promise<boolean> {
  const segredo = req.headers.get("x-wp-segredo") || "";
  if (segredo.length < 20) return false;
  const { data } = await db.rpc("wallapop_segredo_interno");
  return typeof data === "string" && data === segredo;
}

// Mesmas regras do site para o nome do anexo (sem acentos nem caracteres proibidos).
function limparNome(nome: string) {
  return String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\/:*?"<>|#]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, 80);
}

function base64ParaBytes(b64: string): Uint8Array {
  const limpo = String(b64 || "").replace(/^data:[^,]*,/, "");
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function encontrarEncomenda(transacao: string, codigo: string, nome: string) {
  if (transacao) {
    const { data, error } = await db.rpc("wallapop_encomenda_para_etiqueta", { p_transacao: transacao, p_nome: null });
    if (error) throw error;
    if (data?.id) return data;
  }
  if (codigo) {
    const { data, error } = await db.from("encomendas").select("id, codigo_encomenda, estado")
      .ilike("codigo_encomenda", codigo).ilike("origem", "wallapop").limit(2);
    if (error) throw error;
    if (data?.length === 1) return { id: data[0].id, codigo: data[0].codigo_encomenda, estado: data[0].estado, por: "codigo" };
  }
  if (nome) {
    const { data, error } = await db.rpc("wallapop_encomenda_para_etiqueta", { p_transacao: null, p_nome: nome });
    if (error) throw error;
    return data;
  }
  return { erro: "nao_encontrada" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ ok: false, erro: "metodo" }, 405);
  if (!(await autorizado(req))) return resp({ ok: false, erro: "nao_autorizado" }, 401);

  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  const transacaoBruta = String(corpo.transacao || "").trim().toLowerCase();
  const transacao = /^[0-9a-f-]{20,60}$/.test(transacaoBruta) ? transacaoBruta : "";
  const codigoBruto = String(corpo.codigo || "").trim().toUpperCase();
  const codigo = /^[A-Z0-9]{6}$/.test(codigoBruto) ? codigoBruto : "";
  const nome = String(corpo.comprador_nome || "").trim().slice(0, 120);
  if (!transacao && !codigo && !nome) return resp({ ok: false, erro: "sem_dados" }, 400);

  let bytes: Uint8Array;
  try { bytes = base64ParaBytes(corpo.pdf_base64); } catch { return resp({ ok: false, erro: "pdf_invalido" }, 400); }
  if (bytes.length < 100 || bytes.length > MAX_BYTES) return resp({ ok: false, erro: "pdf_tamanho" }, 400);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return resp({ ok: false, erro: "nao_e_pdf" }, 400);

  let enc: any;
  try { enc = await encontrarEncomenda(transacao, codigo, nome); }
  catch (e) { return resp({ ok: false, erro: String((e as any)?.message || e) }, 500); }
  if (!enc?.id) return resp({ ok: false, erro: enc?.erro || "nao_encontrada", n: enc?.n ?? null });

  const pasta = String(enc.id);
  const { data: existentes, error: erroLista } = await db.storage.from(BUCKET).list(pasta, { limit: 1000 });
  if (erroLista) return resp({ ok: false, erro: erroLista.message }, 500);
  if ((existentes || []).some((f: any) => /etiqueta/i.test(String(f?.name || "")))) {
    return resp({ ok: true, acao: "ja_tinha", codigo: enc.codigo, por: enc.por });
  }

  const aleatorio = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  const ficheiro = `Etiqueta Wallapop - ${limparNome(nome || enc.codigo || "comprador") || "comprador"}.pdf`;
  const caminho = `${pasta}/${Date.now()}-${aleatorio}-${ficheiro}`;
  const { error: erroUp } = await db.storage.from(BUCKET).upload(caminho, bytes, { contentType: "application/pdf", cacheControl: "3600", upsert: false });
  if (erroUp) return resp({ ok: false, erro: erroUp.message }, 500);
  return resp({ ok: true, acao: "anexada", codigo: enc.codigo, por: enc.por, ficheiro });
});
