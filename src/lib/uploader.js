// src/lib/uploader.js
// Utilitários de importação de campanhas (CSV/JSON) + merge por KM

// --- helpers básicos ---
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// tenta inferir km a partir de possíveis nomes de coluna
function pickKm(obj) {
  // suportamos "km" em km+mmm (333+946) ou "km_abs_m" (metros absolutos)
  if (obj.km != null) {
    const s = String(obj.km);
    if (s.includes("+")) {
      const [k, m] = s.split("+");
      const km = Number(k);
      const mmm = Number(m);
      if (Number.isFinite(km) && Number.isFinite(mmm)) {
        return +(km + mmm / 1000).toFixed(3);
      }
    }
    const kn = toNumber(obj.km);
    if (kn != null) return +kn.toFixed(3);
  }
  if (obj.km_abs_m != null) {
    const m = toNumber(obj.km_abs_m);
    if (m != null) return +(m / 1000).toFixed(3);
  }
  if (obj.km_float != null) {
    const f = toNumber(obj.km_float);
    if (f != null) return +f.toFixed(3);
  }
  return null;
}

// normaliza nomes de colunas tipo curv/xlev/rate/twist/warp/gage
function normalizeFieldName(name) {
  const n = String(name).toLowerCase().trim();
  if (n.includes("curv")) return "curv";
  if (n.includes("xlev") || n.includes("cross")) return "xlev";
  if (n.includes("rate") || n.includes("gradient")) return "rate";
  if (n.includes("twist")) return "twist";
  if (n.includes("warp")) return "warp";
  if (n.includes("gage") || n.includes("gauge")) return "gage";
  return null;
}

// --- CSV parser simples (sem libs externas) ---
function parseCSV(text) {
  // separa por linhas respeitando \r\n
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(","); // simples: não lida com vírgula entre aspas
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

// --- API pública ---
// Detecta automaticamente JSON ou CSV; retorna { campaignId, rows }
export async function loadCampaignFile(file) {
  const name = file.name || "campanha";
  const base = name.replace(/\.[^.]+$/, ""); // sem extensão
  const campaignId = base; // por padrão, usamos o nome do arquivo como ID

  const text = await file.text();

  // tenta JSON primeiro
  try {
    const json = JSON.parse(text);
    // formatos aceitos: array de objetos OU { data:[...] }
    const arr = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : null);
    if (arr) {
      const rows = arr.map((o) => {
        const km = pickKm(o);
        const out = { km };
        for (const k of Object.keys(o)) {
          const field = normalizeFieldName(k);
          if (!field) continue;
          const val = toNumber(o[k]);
          out[`${field}_${campaignId}`] = val;
        }
        return out;
      }).filter(r => r.km != null);
      rows.sort((a,b)=>a.km-b.km);
      return { campaignId, rows };
    }
    // se não deu match, cai para CSV
  } catch (_) {
    // segue o fluxo para CSV
  }

  // CSV
  const csvRows = parseCSV(text);
  const rows = csvRows.map((o) => {
    const km = pickKm(o);
    const out = { km };
    for (const k of Object.keys(o)) {
      const field = normalizeFieldName(k);
      if (!field) continue;
      const val = toNumber(o[k]);
      out[`${field}_${campaignId}`] = val;
    }
    return out;
  }).filter(r => r.km != null);
  rows.sort((a,b)=>a.km-b.km);
  return { campaignId, rows };
}

// Junta vários arrays de pontos [{km, ...}] por KM
export function mergeByKm(arrays) {
  const map = new Map();
  for (const arr of arrays) {
    for (const row of arr) {
      const k = row.km;
      const acc = map.get(k) || { km: k };
      Object.assign(acc, row);
      map.set(k, acc);
    }
  }
  return [...map.values()].sort((a,b)=>a.km-b.km);
}

// CSV exporter (usado pelo App)
export function exportCSV(data, campaigns, startIndex, endIndex){
  if (!data?.length) return;
  const fields = ["curv","xlev","rate","twist","warp","gage"];
  const headers = ["km"].concat(
    campaigns.flatMap(c => fields.map(f => `${f}_${c}`))
  );

  const s = Math.max(0, startIndex ?? 0);
  const e = Math.min(data.length-1, endIndex ?? (data.length-1));
  const rows = [];
  for(let i=s;i<=e;i++){
    const r = data[i];
    rows.push(headers.map(h => r[h] ?? "").join(","));
  }
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "railsight_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}
