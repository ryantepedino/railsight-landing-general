// src/lib/quality.js
const num = v => (typeof v === "number" && !Number.isNaN(v));

export function channelQuality(data, campaigns, field) {
  const out = {};
  campaigns.forEach(c => {
    const xs = data.map(r => r[`${field}_${c}`]).filter(num);
    if (!xs.length) return;
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const varc = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    out[c] = { mean, min, max, sd: Math.sqrt(varc) };
  });
  return out;
}

export function overallQuality(map) {
  // opcional para um dashboard geral
  return map;
}
