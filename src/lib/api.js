// src/lib/api.js
// Camada de API do frontend — lê .env do Vite (VITE_API_BASE / VITE_API_KEY)

const BASE =
  (typeof import.meta !== "undefined" &&
   import.meta.env &&
   import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : "http://localhost:8787";

const API_KEY =
  (typeof import.meta !== "undefined" &&
   import.meta.env &&
   import.meta.env.VITE_API_KEY)
    ? import.meta.env.VITE_API_KEY
    : "troque-esta-chave";

// Log de diagnóstico (aparece no console do navegador ao carregar o app)
try {
  console.log("[API] BASE =", BASE);
  console.log("[API] KEY  =", API_KEY ? "•".repeat(8) : "(vazia)");
} catch {}

async function http(method, path, body, extraHeaders = {}) {
  const url = `${BASE}${path}`;
  const headers = { "x-api-key": API_KEY, ...extraHeaders };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${method} ${path} ${res.status}: ${txt || res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// Endpoints
export async function getCampaigns() {
  return http("GET", "/campaigns");
}
export async function uploadCampaign(file) {
  const fd = new FormData();
  fd.append("file", file);
  return http("POST", "/upload", fd);
}
export async function exportCsv(params = {}) {
  return http("POST", "/export", params);
}

// (opcional) util p/ depuração em UI
export function getApiInfo() {
  return { BASE, API_KEY: API_KEY ? "••••••••" : "" };
}
