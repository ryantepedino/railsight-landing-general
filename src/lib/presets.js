// src/lib/presets.js
export const PRESETS = {
  default: {
    id: "default",
    name: "ABNT Básico",
    channels: {
      // Aviso: valores exemplares — ajuste conforme contrato
      curv:  { warn: 4.0, alarm: 6.0 }, // 1/m (somente limites superiores)
      xlev:  { warn: 20, alarm: 35 },   // mm
      rate:  { warn: 6,  alarm: 8 },    // mm/m
      twist: { warn: 4,  alarm: 6 },    // mm
      warp:  { warn: 2,  alarm: 3 },    // mm
      gage:  { warnLow: 1595, warnHigh: 1615 } // mm (faixa aceitável)
    }
  }
};

export function getPresetById(id = "default") {
  return PRESETS[id] || PRESETS.default;
}
