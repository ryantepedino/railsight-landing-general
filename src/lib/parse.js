// src/lib/parse.js
// Responsável por ler dados brutos (CSV, JSON) e transformar em séries RailSight

export async function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const rows = lines.map(l => l.split(","));

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = parseFloat(r[i]) || r[i];
    });
    return obj;
  });
}

export async function parseJSON(text) {
  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : [json];
  } catch (e) {
    console.error("Erro ao parsear JSON:", e);
    return [];
  }
}

// Normalizador de campanhas: garante que temos { km, curv_X, xlev_X, ... }
export function normalizeCampaign(data, campaignId) {
  return data.map(d => ({
    km: +d.km,
    [`curv_${campaignId}`]: d.curv ?? null,
    [`xlev_${campaignId}`]: d.xlev ?? null,
    [`rate_${campaignId}`]: d.rate ?? null,
    [`twist_${campaignId}`]: d.twist ?? null,
    [`warp_${campaignId}`]: d.warp ?? null,
    [`gage_${campaignId}`]: d.gage ?? null,
  }));
}
