// src/lib/events.js
// Varre dados e aponta amostras que cruzam limites (warn/alarm)

export function findEvents(data, campaigns, limits) {
  const evts = [];
  if (!data?.length) return evts;

  campaigns.forEach(c => {
    Object.entries(limits).forEach(([field, cfg]) => {
      if (!cfg?.lines) return;
      const key = (k) => `${field}_${c}`;
      data.forEach(row => {
        const v = row[key()];
        if (v == null) return;
        cfg.lines.forEach(L => {
          const pass = L.y >= 0 ? v > L.y : v < L.y;
          if (pass) evts.push({ km: row.km, campaign: c, field, value: v, level: L.color });
        });
      });
    });
  });

  return evts;
}

export function criticalMarkers(events) {
  return events.filter(e => e.level === "#ef4444"); // vermelho = alarm
}
