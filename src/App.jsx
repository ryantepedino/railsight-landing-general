import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE; // https://railsight-api.onrender.com

export default function App() {
  // Controles de janela
  const [kmIni, setKmIni] = useState(333800);
  const [windowM, setWindowM] = useState(300);
  const [stepM] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState(null);

  // Busca dados
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const url = `${API_BASE}/segment?km_ini=${kmIni}&window_m=${windowM}&step_m=${stepM}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setPayload(json);
      } catch (e) {
        setErr(`Falha ao buscar API: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [kmIni, windowM, stepM]);

  // Monta os pontos alinhados no eixo X (metros relativos à janela)
  const points = useMemo(() => {
    if (!payload?.series) return [];
    const step = payload?.step_m ?? 1;
    const curv = payload.series.curvature || [];
    const cross = payload.series.crosslevel || [];
    const gauge = payload.series.gauge || [];
    const maxLen = Math.max(curv.length, cross.length, gauge.length);

    const arr = [];
    for (let i = 0; i < maxLen; i++) {
      arr.push({
        x_m: i * step,
        curvature: curv[i] ?? null,
        crosslevel: cross[i] ?? null,
        gauge: gauge[i] ?? null,
      });
    }
    return arr;
  }, [payload]);

  // Navegação
  const prev100 = () => setKmIni(kmIni - 100);
  const next100 = () => setKmIni(kmIni + 100);

  // Exportar CSV da janela atual
  const exportCSV = () => {
    const rows = [["x_m", "curvature_deg", "crosslevel_mm", "gauge_mm"]];
    points.forEach(p => rows.push([p.x_m, p.curvature, p.crosslevel, p.gauge]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const kmRef = payload?.km_ini ?? kmIni;
    a.download = `railsight_segment_km${kmRef}_win${windowM}_step${stepM}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ padding: 16, maxWidth: 1120, margin: "0 auto", fontFamily: "Inter, system-ui, Arial" }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>RailSight – Janela de Via</h1>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Fonte: <code>{API_BASE}/segment</code> — janela <strong>{windowM} m</strong>, step <strong>{stepM} m</strong>.{" "}
          Referência (km real): <strong>{payload?.km_ini ?? kmIni}</strong>. Eixo X em <strong>metros relativos</strong>.
        </p>
      </header>

      {/* Controles */}
      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={prev100} style={btn}>◀︎ −100 m</button>
        <button onClick={next100} style={btn}>+100 m ▶︎</button>

        <span style={{ marginLeft: 12, color: "#374151" }}>Janela:</span>
        {[200, 300, 500].map(w => (
          <button
            key={w}
            onClick={() => setWindowM(w)}
            style={{ ...btn, ...(windowM === w ? btnPrimary : {}) }}
            aria-pressed={windowM === w}
          >
            {w} m
          </button>
        ))}

        <span style={{ marginLeft: 12, color: "#374151" }}>
          KM inicial (ref): <strong>{kmIni}</strong>
        </span>

        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} style={{ ...btn, ...btnPrimary }}>Exportar CSV</button>
        <button onClick={() => window.print()} style={btn}>Salvar em PDF (imprimir)</button>
      </section>

      {err && <p style={{ color: "#e11d48" }}>{err}</p>}
      {loading && <p>Carregando…</p>}

      {/* Gráfico 1: Curvatura */}
      <ChartCard title="Curvatura (°)" subtitle="0° = tangente; picos formam a curva (quebra-molas)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="x_m" tickFormatter={(v)=>`${v}`} label={{ value: "Distância na janela (m)", position: "insideBottom", offset: -2 }}/>
            <YAxis label={{ value: "°", angle: -90, position: "insideLeft" }}/>
            <Tooltip labelFormatter={(l)=>`${l} m`} formatter={(v)=>[v,"Curvatura (°)"]}/>
            <Legend />
            <Line type="monotone" dataKey="curvature" name="Curvatura (°)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico 2: Crosslevel (super-elevação) */}
      <ChartCard title="Crosslevel (mm)" subtitle="Diferença de nível entre trilhos (super-elevação)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="x_m" tickFormatter={(v)=>`${v}`} />
            <YAxis label={{ value: "mm", angle: -90, position: "insideLeft" }}/>
            <Tooltip labelFormatter={(l)=>`${l} m`} formatter={(v)=>[v,"Crosslevel (mm)"]}/>
            <Legend />
            <Line type="monotone" dataKey="crosslevel" name="Crosslevel (mm)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico 3: Bitola */}
      <ChartCard title="Bitola (mm)" subtitle="Variação de bitola dentro da janela">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="x_m" tickFormatter={(v)=>`${v}`} />
            <YAxis label={{ value: "mm", angle: -90, position: "insideLeft" }}/>
            <Tooltip labelFormatter={(l)=>`${l} m`} formatter={(v)=>[v,"Bitola (mm)"]}/>
            <Legend />
            <Line type="monotone" dataKey="gauge" name="Bitola (mm)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </main>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ margin: "4px 0 8px 4px" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ margin: 0, color: "#6b7280" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

const btn = {
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#1f2937",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer"
};
const btnPrimary = {
  background: "#2563eb",
  color: "#fff",
  borderColor: "#2563eb"
};
