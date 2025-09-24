import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/,"");
const PY_API   = import.meta.env.VITE_PY_API?.replace(/\/+$/,""); // opcional
const MAX_RETRY_MS = [1500, 3000, 5000, 8000];

function movingAverage(arr, span = 5) {
  if (!Array.isArray(arr) || span <= 1) return arr;
  const out = new Array(arr.length);
  const half = Math.floor(span / 2);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, c = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < arr.length) { s += arr[j]; c++; }
    }
    out[i] = s / c;
  }
  return out;
}
const gridColor  = "rgba(255,255,255,.09)";
const axisColor  = "rgba(255,255,255,.78)";
const commonGrid = <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />;
const commonTooltip = (labelFormatter) => ({
  contentStyle: { background: "#0B1020", border: "1px solid #1F2A44" },
  labelStyle:   { color: "#9FC1FF" },
  itemStyle:    { color: "#fff" },
  labelFormatter,
});
function niceDomain([min, max], pad = 0, step = 1) {
  if (!isFinite(min) || !isFinite(max)) return ["auto","auto"];
  const lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  return [lo, hi];
}
function autoTicksKm(data, maxTicks = 8) {
  if (!data?.length) return undefined;
  const xs = data.map(d => d.x);
  const min = Math.min(...xs), max = Math.max(...xs);
  const span = max - min; if (span <= 0) return [min];
  const candidates = [0.001, 0.002, 0.005, 0.01, 0.02];
  let step = candidates[0];
  for (const c of candidates) { if (span / c <= maxTicks) { step = c; break; } }
  const ticks = [];
  let t = Math.ceil(min / step) * step;
  for (; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(3));
  return ticks;
}
async function fetchJsonWithRetry(url) {
  let lastErr = null;
  for (let i = 0; i < MAX_RETRY_MS.length; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      lastErr = err;
      await new Promise(res => setTimeout(res, MAX_RETRY_MS[i]));
    }
  }
  throw lastErr ?? new Error("Falha ao buscar dados");
}
async function processInPython(segment) {
  if (!PY_API) return null;
  try {
    const r = await fetch(`${PY_API}/process`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(segment),
    });
    if (!r.ok) throw new Error(`PY HTTP ${r.status}`);
    return await r.json();
  } catch {
    return null;
  }
}

function CurvatureChart({ data, domain, refLinesKm=[] }) {
  return (
    <div className="card">
      <h3>Curvatura (°)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 8 }}>
          {commonGrid}
          <XAxis dataKey="x" stroke={axisColor} tick={{ fill: axisColor }} ticks={autoTicksKm(data)} />
          <YAxis stroke={axisColor} tick={{ fill: axisColor }} domain={domain}
            tickFormatter={(v)=>`${v.toFixed(1)}°`} />
          <Tooltip {...commonTooltip((x)=>`${x.toFixed(3)} km`)} />
          <Legend />
          {refLinesKm.map((km,i)=>(
            <ReferenceLine key={i} x={km} stroke="#ff7ab6" strokeDasharray="3 3" />
          ))}
          <Line type="monotone" dataKey="y" name="Curvatura" stroke="#A78BFA"
                strokeWidth={2.2} dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function CrosslevelChart({ data, domain, refLinesKm=[] }) {
  return (
    <div className="card">
      <h3>Crosslevel (mm)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 8 }}>
          {commonGrid}
          <XAxis dataKey="x" stroke={axisColor} tick={{ fill: axisColor }} ticks={autoTicksKm(data)} />
          <YAxis stroke={axisColor} tick={{ fill: axisColor }} domain={domain}
            tickFormatter={(v)=>`${v} mm`} />
          <Tooltip {...commonTooltip((x)=>`${x.toFixed(3)} km`)} />
          <Legend />
          {refLinesKm.map((km,i)=>(
            <ReferenceLine key={i} x={km} stroke="#ff7ab6" strokeDasharray="3 3" />
          ))}
          <Line type="monotone" dataKey="y" name="Crosslevel" stroke="#60A5FA"
                strokeWidth={2.2} dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function GaugeChart({ data, domain, refLinesKm=[] }) {
  return (
    <div className="card">
      <h3>Bitola (mm)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 8 }}>
          {commonGrid}
          <XAxis dataKey="x" stroke={axisColor} tick={{ fill: axisColor }} ticks={autoTicksKm(data)} />
          <YAxis stroke={axisColor} tick={{ fill: axisColor }} domain={domain}
            tickCount={8} tickFormatter={(v)=>`${v} mm`} />
          <Tooltip {...commonTooltip((x)=>`${x.toFixed(3)} km`)} />
          <Legend />
          {refLinesKm.map((km,i)=>(
            <ReferenceLine key={i} x={km} stroke="#ff7ab6" strokeDasharray="3 3" />
          ))}
          <Line type="monotone" dataKey="y" name="Bitola" stroke="#F87171"
                strokeWidth={2.4} dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function App(){
  const [segment, setSegment] = useState(null);
  const [status, setStatus]   = useState("idle");
  const [msg, setMsg]         = useState("");
  const [win, setWin]         = useState(300);
  const [kmIniOverride, setKmIniOverride] = useState(null);
  const refKm = useMemo(()=>[66.940, 66.945],[]);

  useEffect(()=>{
    (async()=>{
      setStatus("loading"); setMsg("Carregando…");
      try{
        const url = `${API_BASE}/segment?window=${win}`;
        const seg = await fetchJsonWithRetry(url);
        if(!seg?.series) throw new Error("Segmento inválido");
        const segUse = {
          ...seg,
          km_ini: kmIniOverride ?? seg.km_ini,
          window_m: seg.window_m ?? win,
          step_m: seg.step_m ?? 1
        };
        const py = await processInPython(segUse);
        setSegment(py?.series ? {...segUse, series: py.series, meta: py.meta} : segUse);
        setStatus("ok"); setMsg("");
      }catch(err){
        setStatus("err"); setMsg(String(err?.message || err));
      }
    })();
  },[win, kmIniOverride]);

  const xKm = useMemo(()=>{
    if(!segment) return [];
    const n = Object.values(segment.series)[0]?.length ?? 0;
    const km0 = (segment.km_ini ?? 333800)/1000;
    return Array.from({length:n}, (_,i)=> +(km0 + i/1000).toFixed(3));
  },[segment]);

  const dataCurv = useMemo(()=>{
    if(!segment?.series?.curvature) return [];
    const ys = segment.series.curvature;
    return xKm.map((x,i)=>({ x, y:+((ys[i] ?? 0)).toFixed(3) }));
  },[segment, xKm]);

  const dataCross = useMemo(()=>{
    if(!segment?.series?.crosslevel) return [];
    const ys = movingAverage(segment.series.crosslevel, 5);
    return xKm.map((x,i)=>({ x, y:+((ys[i] ?? 0)).toFixed(2) }));
  },[segment, xKm]);

  const dataGauge = useMemo(()=>{
    if(!segment?.series?.gauge) return [];
    const ys = movingAverage(segment.series.gauge, 3);
    return xKm.map((x,i)=>({ x, y:+((ys[i] ?? 0)).toFixed(1) }));
  },[segment, xKm]);

  const domCurv = useMemo(()=>{
    if(!dataCurv.length) return ["auto","auto"];
    const vals = dataCurv.map(d=>d.y); return niceDomain(
      [Math.min(...vals), Math.max(...vals)], .2, .5
    );
  },[dataCurv]);

  const domCross = useMemo(()=>{
    if(!dataCross.length) return ["auto","auto"];
    const vals = dataCross.map(d=>d.y);
    const auto = niceDomain([Math.min(...vals), Math.max(...vals)], 1, 1);
    return [Math.min(-5, auto[0]), Math.max(15, auto[1])];
  },[dataCross]);

  const domGauge = useMemo(()=>{
    if(!dataGauge.length) return [1600,1635];
    const vals = dataGauge.map(d=>d.y);
    const auto = niceDomain([Math.min(...vals), Math.max(...vals)], 2, 1);
    return [Math.min(1600, auto[0]), Math.max(1635, auto[1])];
  },[dataGauge]);

  function exportCSV(){
    if(!segment) return;
    const rows = ["km,y_curvature,y_crosslevel,y_gauge"];
    const n = xKm.length;
    for(let i=0;i<n;i++){
      rows.push([
        xKm[i],
        dataCurv[i]?.y ?? "",
        dataCross[i]?.y ?? "",
        dataGauge[i]?.y ?? ""
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], {type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `railsight_segment_${segment.km_ini}_${segment.window_m}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  function printPDF(){
    window.print();
  }

  return (
    <div>
      <div className="bar">
        <span className="logoDot"></span>
        <b>Data Tech RailSight</b>
        <button className="btn right" onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}>
          Entrar na Demo
        </button>
        <a className="btn primary" href="https://wa.me/5532991413852" target="_blank" rel="noopener">Agendar no WhatsApp</a>
      </div>

      <div className="hero">
        <div>
          <h1>RailSight — Inteligência em Monitoramento Ferroviário</h1>
          <p className="muted">Reduza falhas, aumente a segurança e otimize custos em qualquer operação — carga ou passageiros.</p>
          <div className="call">
            <button className="btn primary" onClick={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}>
              Entrar na Demo
            </button>
            <a className="btn ghost" href="https://wa.me/5532991413852" target="_blank" rel="noopener">Agendar no WhatsApp</a>
          </div>
        </div>
        <div className="note">
          <b>Preparando demonstração…</b><br/>
          Na primeira visita a API pode demorar ~60s (free tier). Obrigado por aguardar!
        </div>
      </div>

      <div id="demo" className="card">
        <div className="row" style={{marginBottom:6}}>
          <b className="muted">API base:</b>
          <code style={{color:"#9FC1FF"}}>{API_BASE}</code>
          {PY_API && <>
            <b className="muted" style={{marginLeft:12}}>Python proc:</b>
            <code style={{color:"#9FC1FF"}}>{PY_API}</code>
          </>}
          <span className="right segCtrls">
            <span className="muted">Janela:</span>
            {[200,300,500].map(v=>(
              <span key={v} className={`chip ${win===v?"sel":""}`} onClick={()=>setWin(v)}>{v} m</span>
            ))}
            <button className="btn" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn ghost" onClick={printPDF}>Salvar em PDF</button>
          </span>
        </div>

        {status==="loading" && <div className="card" style={{borderStyle:"dashed"}}>{msg || "Carregando…"}</div>}
        {status==="err" && <div className="card" style={{borderColor:"#DA4453", color:"#FFCED3"}}>Erro: {msg}</div>}

        {status==="ok" && (
          <div className="grid">
            <CurvatureChart data={dataCurv} domain={domCurv} refLinesKm={[66.940,66.945]} />
            <CrosslevelChart data={dataCross} domain={domCross} refLinesKm={[66.940,66.945]} />
            <GaugeChart     data={dataGauge} domain={domGauge} refLinesKm={[66.940,66.945]} />
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")).render(<App />);
