import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Automação Wallapop: recebe os emails "Fizeste uma venda" / "Venda confirmada" (ou em espanhol "Has hecho una venta" / "Venta confirmada") (enviados pelo script do Gmail),
// tira deles o comprador, a transação e os títulos, pergunta ao Wallapop o perfil do comprador e aplica as regras
// (função public.wallapop_processar_email). Com "simular": true nada fica gravado.
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

// CORS só para os testes a partir do site (o script do Gmail não precisa).
const CORS = {
  "Access-Control-Allow-Origin": "https://figuresplanet.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function resp(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function autorizado(req: Request): Promise<boolean> {
  const segredo = req.headers.get("x-wp-segredo");
  if (segredo) {
    const { data } = await db.rpc("wallapop_segredo_interno");
    return typeof data === "string" && data.length > 20 && data === segredo;
  }
  // Admin com sessão (só para testes a partir do site).
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const cli = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await cli.rpc("is_admin");
  return !error && data === true;
}

function desescapar(t: string) {
  return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
}

function lerEmail(html: string) {
  const nome = html.match(/Comprado por:\s*<\/div>\s*<div[^>]*>([^<]*)<\/div>/);
  const titulos = [...html.matchAll(/<p style="font-size:14px;line-height:24px;margin:0 8px">([^<]*)<\/p>/g)].map((m) => desescapar(m[1])).filter(Boolean);
  const link = html.match(/delivery%2Ftimeline%3Fb=([a-z0-9]+)%26i=([a-z0-9]+)%26r=([0-9a-f-]+)/i);
  const total = html.match(/Total<\/span>\s*<span[^>]*>([^<]*)<\/span>/);
  return {
    comprador_nome: nome ? desescapar(nome[1]) : null,
    titulos,
    comprador_hash: link?.[1] ?? null,
    item_hash: link?.[2] ?? null,
    transacao: link?.[3] ?? null,
    total: total ? Number(String(total[1]).replace(/[^0-9.,]/g, "").replace(",", ".")) || null : null,
  };
}

function tipoPeloAssunto(assunto: string): "venda" | "confirmada" | null {
  if (/Fizeste uma venda|Has hecho una venta/i.test(assunto)) return "venda";
  if (/Venda confirmada|Venta confirmada/i.test(assunto)) return "confirmada";
  return null;
}

// Perfil público do comprador no Wallapop (sem login).
async function perfilWallapop(hash: string): Promise<{ slug: string | null; pais?: string | null; erro?: string }> {
  try {
    const r = await fetch(`https://api.wallapop.com/api/v3/users/${encodeURIComponent(hash)}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return { slug: null, erro: `http_${r.status}` };
    const j = await r.json();
    const slug = String(j?.web_slug || "").trim().toLowerCase();
    const pais = String(j?.location?.country_code || "").trim().toUpperCase() || null;
    return slug ? { slug, pais } : { slug: null, erro: "sem_slug" };
  } catch (e) {
    return { slug: null, erro: String(e) };
  }
}

// País a partir do link do perfil (página Plataformas, admin): Wallapop, Vinted ou OLX.
// Wallapop: a página pública do perfil traz o código interno do utilizador; a API dá o país desse código.
async function paisDoPerfil(link: string): Promise<{ ok: boolean; pais?: string | null; codigo?: string | null; erro?: string }> {
  let url: URL;
  try { url = new URL(String(link || "").trim()); } catch { return { ok: false, erro: "link_invalido" }; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const caminho = decodeURIComponent(url.pathname).replace(/\/+$/, "");
  const cabecalhos = { "User-Agent": "Mozilla/5.0", Accept: "text/html" };
  try {
    if (host === "wallapop.com" || host.endsWith(".wallapop.com")) {
      const slug = (caminho.match(/\/user\/([^/?#]+)$/i)?.[1] || "").toLowerCase();
      if (!slug) return { ok: false, erro: "link_invalido" };
      const r = await fetch(`https://es.wallapop.com/user/${encodeURIComponent(slug)}`, { headers: cabecalhos });
      if (!r.ok) return { ok: false, erro: `perfil_http_${r.status}` };
      const html = await r.text();
      const candidatos = [...new Set([...html.matchAll(/"id"\s*:\s*"([a-z0-9]{10,14})"/g)].map((m) => m[1]))].slice(0, 6);
      for (const hash of candidatos) {
        const p = await perfilWallapop(hash);
        if (p.slug === slug) return { ok: true, codigo: p.pais || null };
      }
      return { ok: false, erro: "perfil_sem_pais" };
    }
    if (/^vinted\.[a-z.]+$/i.test(host)) {
      const membro = caminho.match(/\/member\/(\d+)/i)?.[1];
      if (!membro) return { ok: false, erro: "link_invalido" };
      const r = await fetch(`https://www.vinted.pt/member/${membro}`, { headers: cabecalhos });
      if (!r.ok) return { ok: false, erro: `perfil_http_${r.status}` };
      const html = await r.text();
      const m = html.match(/country_title(?:_local)?\\?"\s*:\s*\\?"([^"\\]+)/);
      const pais = m ? desescapar(m[1]) : "";
      return pais && pais.length <= 40 ? { ok: true, pais } : { ok: false, erro: "perfil_sem_pais" };
    }
    if (host === "olx.pt" || host.endsWith(".olx.pt")) return { ok: true, codigo: "PT" };
    return { ok: false, erro: "plataforma_sem_pais" };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ ok: false, erro: "metodo" }, 405);
  if (!(await autorizado(req))) return resp({ ok: false, erro: "nao_autorizado" }, 401);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  if (corpo.pais_perfil) return resp(await paisDoPerfil(String(corpo.pais_perfil)));
  const simular = corpo.simular !== false; // por defeito só simula; o script envia simular:false quando estiver ligado a sério
  const emails = (Array.isArray(corpo.emails) ? corpo.emails : []).slice(0, 30);
  const resultados: any[] = [];

  for (const e of emails) {
    const message_id = String(e?.message_id || "");
    const tipo = tipoPeloAssunto(String(e?.subject || ""));
    if (!message_id || !tipo) { resultados.push({ message_id, ok: true, acao: "ignorado" }); continue; }
    const lido = lerEmail(String(e?.html || ""));
    if (!lido.titulos.length || !lido.transacao) {
      resultados.push({ message_id, ok: false, erro: "formato_email_desconhecido" });
      continue;
    }
    let perfil: { slug: string | null; pais?: string | null; erro?: string } = { slug: null };
    if (lido.comprador_hash) perfil = await perfilWallapop(lido.comprador_hash);
    if (!perfil.slug) {
      // Sem perfil não se trata: o script volta a tentar na próxima execução.
      resultados.push({ message_id, ok: false, erro: `perfil_indisponivel: ${perfil.erro || "sem_codigo"}` });
      continue;
    }
    const p = { message_id, tipo, recebido_em: e?.date || null, perfil_slug: perfil.slug, pais_codigo: perfil.pais || null, ...lido };
    const { data, error } = await db.rpc("wallapop_processar_email", { p, p_simular: simular });
    if (error) resultados.push({ message_id, ok: false, erro: error.message });
    else resultados.push({ message_id, ok: true, simulado: simular, ...data });
    // Em simulação nada fica nas encomendas: guarda-se o que teria feito, para comparar com o que foi feito à mão.
    if (simular && corpo.registar_simulacao !== false) {
      await db.from("wallapop_simulacoes").insert({
        message_id, recebido_em: p.recebido_em, tipo, comprador: lido.comprador_nome, perfil_slug: perfil.slug,
        titulos: lido.titulos, resultado: error ? { erro: error.message } : data,
      });
    }
  }
  return resp({ ok: resultados.every((r) => r.ok), simulado: simular, resultados });
});
