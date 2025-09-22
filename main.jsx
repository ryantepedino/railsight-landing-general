import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE || "https://railsight-api.onrender.com";

// -------- util: retry com backoff ----------
async function fetchWithRetry(path, { retries = [2000, 5000, 10000] } = {}) {
  const url = `${API_BASE}${path}`;
  let lastErr;
  for (let i = 0; i <= retries.length; i++) {
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries.length) {
        await new Promise(r => setTimeout(r, retries[i]));
      }
    }
  }
  throw lastErr;
}

// -------- helpers p/ export ----------
function toCSV(rows) {
  // rows: array de objetos
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map(h => r[h]).join(","));
  return lines.join("\n");
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

// -------- componente Demo ----------
function DemoSection() {
  const [kmIni, setKmIni] = useState(333800);  // valor referência (igual ao mock)
  const [win, setWin] = useState(300);
  const [step] = useState(1);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error
  const [message, setMessage] = useState("");

  // transforma o JSON da API em linhas para os gráficos
  const series = useMemo(() => {
    if (!data?.series) return [];
    const n = data.series.curvature?.length || 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        x: i, // metros relativos dentro da janela
        curvature: round(data.series.curvature?.[i]),
        crosslevel: round(data.series.crosslevel?.[i]),
        gauge: round(data.series.gauge?.[i]),
      });
    }
    return out;
  }, [data]);

  function round(v) {
    if (typeof v !== "number") return v;
    return Math.round(v * 1000) / 1000;
  }

  async function load() {
    setState("loading");
    setMessage("Conectando à API…");
    try {
      // o endpoint já suporta os defaults; se quiser no futuro:
      // const q = `?km_ini=${kmIni}&window_m=${win}&step_m=${step}`;
      const json = await fetchWithRetry("/segment");
      setData(json);
      setState("ok");
    } catch (err) {
      setMessage(
        "Falha ao carregar dados. O servidor gratuito pode demorar a acordar. Tente atualizar a página ou volte em instantes."
      );
      setState("error");
      console.error(err);
    }
  }

  useEffect(() => {
    setMessage("Acordando servidor (Render Free)… a primeira chamada pode levar até 60s.");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmIni, win, step]);

  function move(delta) {
    setKmIni((k) => k + delta); // apenas visual/placeholder (mock não usa por enquanto)
  }

  function exportCSV() {
    const csv = toCSV(series.map(r => ({
      x_m: r.x,
      curvature_deg: r.curvature ?? "",
      crosslevel_mm: r.crosslevel ?? "",
      gauge_mm: r.gauge ?? "",
    })));
    download(`railsight_janela_${win}m_km${kmIni}.csv`, csv);
  }

  function printPDF() {
    // abre diálogo do navegador; o usuário escolhe "Salvar como PDF"
    window.print();
  }

  const hasData = state === "ok" && series.length > 0;

  return (
    <section style={{ maxWidth: 1120, margin: "24px auto", padding: "0 12px" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#6b7280", fontSize: 14 }}>
            API base: <code>{API_BASE}</code>
          </span>
        </div>

        {/* Controles */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn-out" onClick={() => move(-100)}>-100 m</button>
          <button className="btn-out" onClick={() => move(100)}>+100 m</button>

          <span style={{ marginLeft: 12 }}>Janela:</span>
          {[200, 300, 500].map((w) => (
            <button
              key={w}
              className={`btn-choice ${w === win ? "active" : ""}`}
              onClick={() => setWin(w)}
            >
              {w} m
            </button>
          ))}

          <span style={{ marginLeft: 12, color: "#6b7280" }}>
            KM inicial (ref): <strong>{kmIni}</strong>
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn secondary" onClick={printPDF}>Salvar em PDF (imprimir)</button>
          </div>
        </div>

        {/* Status / loading */}
        {state !== "ok" && (
          <div style={{ marginTop: 12 }}>
            <div className="loader" />
            <p style={{ color: "#6b7280", marginTop: 8 }}>{message}</p>
          </div>
        )}

        {/* Gráficos */}
        {hasData && (
          <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
            <ChartBlock title="Curvatura (°)" data={series} yUnit="°" dataKey="curvature" color="#6366F1" />
            <ChartBlock title="Crosslevel (mm)" data={series} yUnit="mm" dataKey="crosslevel" color="#0EA5E9" />
            <ChartBlock title="Bitola (mm)" data={series} yUnit="mm" dataKey="gauge" color="#22C55E" />
          </div>
        )}

        {/* Aviso se sem dados */}
        {state === "ok" && !hasData && (
          <p style={{ color: "#6b7280", marginTop: 12 }}>
            Sem dados para exibir nesta janela.
          </p>
        )}
      </div>

      {/* estilos rápidos */}
      <style>{`
        .btn {
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn.secondary {
          background: transparent;
          border: 1px solid #93c5fd;
          color: #1f2937;
        }
        .btn:hover { filter: brightness(1.05); }

        .btn-out {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
        }
        .btn-choice {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 6px 10px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-choice.active {
          background: #111827;
          color: white;
          border-color: #111827;
        }
        .loader {
          width: 28px;
          height: 28px;
          border: 3px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

function ChartBlock({ title, data, yUnit, dataKey, color }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>{title}</h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 12 }} label={{ value: "Distância na janela (m)", position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: yUnit, angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} dot={false} stroke={color} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
};

function App() {
  return (
    <>
      {/* Se sua “hero” está no HTML, aqui renderizamos só a demo abaixo */}
      <DemoSection />
    </>
  );
}

createRoot(document.getElementById("app")).render(<App />);

