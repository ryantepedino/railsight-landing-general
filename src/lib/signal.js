// src/lib/signal.js
// Reamostragem simples para grade regular (step em metros)

export function reSample(data, stepM = 1) {
  if (!data?.length) return [];
  const km0 = data[0].km;
  const km1 = data[data.length - 1].km;
  const grid = [];
  for (let km = km0; km <= km1 + 1e-9; km += stepM / 1000) grid.push(+km.toFixed(3));

  function lerp(arr, i, x, xk = "km", yk = "y") {
    const x0 = arr[i][xk], x1 = arr[i + 1][xk];
    const y0 = arr[i][yk], y1 = arr[i + 1][yk];
    const t = (x - x0) / (x1 - x0);
    return y0 + t * (y1 - y0);
  }

  // Descobre todas as chaves (exceto km)
  const keys = Object.keys(data[0]).filter(k => k !== "km");

  // Ponteiros para cada x
  let j = 0;
  const out = [];
  for (const km of grid) {
    while (j < data.length - 2 && data[j + 1].km < km) j++;
    const row = { km };
    keys.forEach(k => {
      if (km <= data[0].km) row[k] = data[0][k];
      else if (km >= data[data.length - 1].km) row[k] = data[data.length - 1][k];
      else row[k] = lerp(data, j, km, "km", k);
    });
    out.push(row);
  }
  return out;
}

// Deriva rate (mm/m) a partir de xlev (mm) em série reamostrada
export function deriveRateFromXlev(rows, keyIn, keyOut, stepM = 1) {
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][keyIn];
    rows[i][keyOut] = prev == null || v == null ? null : (v - prev) / stepM;
    prev = v;
  }
  return rows;
}
