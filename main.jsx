import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

/* ================== CONFIG ================== */
const API_BASE = (import.meta?.env?.VITE_API_BASE) || "https://railsight-api.onrender.com";
/* ============================================ */

/* util: CSV */
function toCSV(rows, headers) {
  const h = headers.join(",");
  const body = rows.map(r => headers.map(k => r[k]).join(",")).join("\n");
  return h + "\n" + body;
}

function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* fetch com retries e mensagens claras */
async function fetchWithRetry(url, opts = {}) {
  const tries = [1000, 3000, 7000]; // 1s, 3s, 7s
  let lastErr = null;
  for (let i = 0; i < tries.length; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (err) {
      lastErr = err;
      await new Promise(res => setTimeout(res, tries[i]));
    }
  }
  if (lastErr) throw lastErr;
}

/* componentes pequenos */
const Pill = ({ children, active, onClick }) => (
  <button className={"chip" + (active ? " active" : "")} onClick={onClick}>{children}</button>
);

const SectionTitle = ({ children }) => (
  <h3 style={{margin:"0 0 8px", fontSize:18}}>{children}</h3>
);

/* gráfico reutilizável */
function MetricChart({ title, unit, data, dataKey, stroke }) {
  return (
    <div className="chartCard">
      <div className="chartTitle">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} syncId="railsight" margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid stroke="#223" strokeDasharray="4 6" />
          <XAxis dataKey="x" tick={{ fill:"#9fb3d9", fontSize:12 }} label={{ value:"Distância na janela (m)", dy: 18, fill:"#9fb3d9" }} />
          <YAxis width={40} tick={{ fill:"#9fb3d9", fontSize:12 }} label={{ value:unit, angle:-90, dx:-10, fill:"#9fb3d9" }} />
          <Tooltip contentStyle={{ background:"#0e1126", border:"1px solid #1d2442", borderRadius:8, color:"#eaf0ff" }} />
          <Line type="monotone" dataKey={dataKey} dot={false} stroke={stroke} strokeWidth={2.2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* página */
function App() {
  const [win, setWin] = useState(300);
  const [km0, setKm0] = useState(333800);
  const [offset, setOffset] = useState(0); // deslocamento relativo
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("Preparando demonstração… Na primeira visita a API pode demorar até ~60s (free tier). Obrigado por aguardar!");
  const [error, setError] = useState("");
  const [raw, setRaw] = useState(null);

  const startKm = km0 + offset;

  const url = useMemo(() => {
    const u = new URL(API_BASE.replace(/\/+$/,"") + "/segment");
    u.searchParams.set("km_ini", String(startKm));
    u.searchParams.set("window_m", String(win));
    u.searchParams.set("step_m", "1");
    return u.toString();
  }, [startKm, win]);

  async function load() {
    setLoading(true);
    setError("");
    setNote("Conectando à API…");
    try {
      const data = await fetchWithRetry(url);
      setRaw(data);
      setNote("Pronto! (API base: " + API_BASE + ")");
    } catch (e) {
      setError("Não foi possível carregar os dados (" + (e?.message || "erro") + "). Tentar novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [url]);

  const series = useMemo(() => {
    if (!raw?.series) return [];
    const n = raw.series.curvature?.length || 0;
    const xs = Array.from({ length: n }, (_, i) => i);
    const toMM = arr => (arr || []).map(v => Number(v));
    const curv = toMM(raw.series.curvature);
    const cross = toMM(raw.series.crosslevel);
    const gauge = toMM(raw.series.gauge);
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        x: xs[i],
        curvature: Number(curv[i] || 0),
        crosslevel: Number(cross[i] || 0),
        gauge: Number(gauge[i] || 0)
      });
    }
    return rows;
  }, [raw]);

  function exportCSV() {
    if (!series.length) return;
    const csv = toCSV(series, ["x","curvature","crosslevel","gauge"]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveBlob("railsight_window_"+win+"_m.csv", blob);
  }
  function printPDF() { window.print(); }

  return (
    <div className="container">
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <span className="logoDot"></span>
          <span>Data Tech <span style={{opacity:.75}}>RailSight</span></span>
        </div>
        <div className="topbtns">
          <a className="btn" href="#demo">Entrar na Demo</a>
          <a className="btn wa" href="https://wa.me/5532991413852" target="_blank" rel="noopener noreferrer">Agendar no WhatsApp</a>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="card">
          <h1 style={{margin:"0 0 6px"}}>RailSight — Inteligência em Monitoramento Ferroviário</h1>
          <p className="muted" style={{margin:"0 0 16px"}}>
            Reduza falhas, aumente a segurança e otimize custos em qualquer operação — carga ou passageiros.
          </p>
          <div className="row">
            <a className="btn primary" href="#demo">Entrar na Demo</a>
            <a className="btn wa" href="https://wa.me/5532991413852" target="_blank" rel="noopener noreferrer">Agendar no WhatsApp</a>
          </div>
        </div>

        <div className="card">
          <div style={{fontWeight:700, marginBottom:6}}>Preparando demonstração…</div>
          <div className="muted" style={{lineHeight:1.4}}>{note}</div>
        </div>
      </div>

      {/* Demo */}
      <div id="demo" className="card" style={{padding:"16px"}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
          <SectionTitle>Janela de Via (conectada à API)</SectionTitle>
          <div className="row">
            <button className="btn" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn" onClick={printPDF}>Salvar em PDF</button>
          </div>
        </div>

        <div className="segTitle">API base: <span className="muted">{API_BASE.replace(/\/+$/,"")}/segment</span></div>

        <div className="controls">
          <div className="row">
            <Pill onClick={() => setOffset(offset - 100)}>−100 m</Pill>
            <Pill onClick={() => setOffset(offset + 100)}>+100 m</Pill>
          </div>
          <div className="row" style={{marginLeft:12}}>
            Janela:
            <Pill active={win===200} onClick={() => setWin(200)}>200 m</Pill>
            <Pill active={win===300} onClick={() => setWin(300)}>300 m</Pill>
            <Pill active={win===500} onClick={() => setWin(500)}>500 m</Pill>
          </div>
          <div className="row" style={{marginLeft:12}}>
            <span className="muted">KM inicial (ref): </span>
            <span style={{fontWeight:700, marginLeft:6}}>{km0}</span>
          </div>
        </div>

        {loading && (
          <div className="card" style={{borderStyle:"dashed", marginTop:8}}>
            <div className="muted">Carregando dados…</div>
          </div>
        )}

        {!!error && (
          <div className="card" style={{borderStyle:"dashed", marginTop:8, borderColor:"#7f1d1d", background:"#290c0f"}}>
            <div style={{color:"#ffb4b4", marginBottom:8}}>{error}</div>
            <button className="btn primary" onClick={load}>Tentar novamente</button>
          </div>
        )}

        {!loading && !error && series.length > 0 && (
          <>
            <MetricChart title="Curvatura (°)" unit="°" data={series} dataKey="curvature" stroke="#a78bfa" />
            <div style={{height:10}} />
            <MetricChart title="Crosslevel (mm)" unit="mm" data={series} dataKey="crosslevel" stroke="#60a5fa" />
            <div style={{height:10}} />
            <MetricChart title="Bitola (mm)" unit="mm" data={series} dataKey="gauge" stroke="#34d399" />
          </>
        )}
      </div>

      <div className="footer space"></div>
    </div>
  );
}

/* mount */
createRoot(document.getElementById("app")).render(<App />);
