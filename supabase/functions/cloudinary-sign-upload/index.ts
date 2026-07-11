import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function normalizarParametros(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function assinarCloudinary(params: Record<string, string | number>, apiSecret: string): Promise<string> {
  return sha1Hex(`${normalizarParametros(params)}${apiSecret}`);
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
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  const folder = Deno.env.get("CLOUDINARY_FOLDER") || "worldminifigures4u";

  if (!supabaseUrl || !supabaseAnonKey || !cloudName || !apiKey || !apiSecret) {
    return jsonResponse(request, { error: "Configuracao Cloudinary/Supabase incompleta." }, 500);
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(request, { error: "Sessao obrigatoria." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await supabase.auth.getUser();
  const email = String(data?.user?.email || "").toLowerCase();

  if (error || !email || !adminEmails().includes(email)) {
    return jsonResponse(request, { error: "Acesso reservado ao administrador." }, 403);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const eager = "e_trim:20/c_limit,w_1200,h_1200";
  const params = { eager, folder, timestamp };
  const signature = await assinarCloudinary(params, apiSecret);

  return jsonResponse(request, {
    cloudName,
    apiKey,
    eager,
    folder,
    timestamp,
    signature,
    maxBytes: 8 * 1024 * 1024,
    allowedFormats: ["image/jpeg", "image/png", "image/webp"],
  });
});