import React, {useEffect, useMemo, useState} from "react";
console.log("API Base:", import.meta.env.VITE_API_BASE);
console.log("PROC Base:", import.meta.env.VITE_PROC_BASE);

import {createRoot} from "react-dom/client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine
} from "recharts";

// ------------- Config & helpers -------------
const API_BASE  = import.meta.env.VITE_API_BASE  || "https://railsight-api.onrender.com";
const PROC_BASE = import.meta.env.VITE_PROC_BASE || "https://railsight-proc-python.onrender.com";

const fmtKm = (km) => km.toFixed(3).replace(".", ",");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function csvDownload(filename, rows) {
  const esc = (v) => (typeof v === "string" && v.includes(",")) ? `"${v.replace(/"/g,'""')}"` : v;
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ------------- API -------------
async function getSegment(window_m=300, km_ini=333800) {
  // Retry com backoff p/ acordar Render
  const url = `${API_BASE}/segment?window_m=${window_m}&km_ini=${km_ini}&step_m=1`;
  let last;
  for (const delay of [0, 1500, 3000, 5000, 8000]) {
    try {
      if (delay) await sleep(delay);
      const r = await fetch(url, {cache:"no-store"});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) { last = err; }
  }
  throw last || new Error("Falhou sem erro.");
}

async function smoothPython(arr, window=11, poly=2) {
  try {
    const r = await fetch(`${PROC_BASE}/process`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({data:arr, window, poly})
    });
    if (!r.ok) throw new Error(`Smooth HTTP ${r.status}`);
    const js = await r.json();
    return js.smoothed ?? arr;
  } catch (_) { return arr; }
}

// ------------- UI Components -------------
function Hero({onGo}) {
  return (
    <section className="hero" id="topo">
      <div className="card">
        <div className="kicker"><span className="logoDot"></span> RailSight — Inteligência em Monitoramento Ferroviário</div>
        <h1>Segurança, confiabilidade e redução de custos em qualquer operação ferroviária — <b>carga ou passageiros</b>.</h1>
        <div className="muted">Painéis interativos: Curvatura, Superelevação (Crosslevel) e Bitola, com navegação por janela (200–500&nbsp;m) e referência de km.</div>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button id="go-demo" className="btn primary" onClick={onGo}>Entrar na Demo</button>
          <a className="btn ghost" href="#beneficios">Saiba mais</a>
        </div>
      </div>
      <div className="card">
        <div className="kicker"><span className="logoDot"></span> O que você vai ver</div>
        <ul className="muted" style={{marginTop:8}}>
          <li>Curvatura 0 = tangente; picos = curva (“quebra-molas”).</li>
          <li>Navegação: <span className="kbd">−100 m</span> / <span className="kbd">+100 m</span> e janela <span className="kbd">200–500 m</span>.</li>
          <li>Exportação: <span className="kbd">CSV</span> e <span className="kbd">PDF</span>.</li>
          <li>Suavização (Savitzky–Golay) via microserviço Python.</li>
        </ul>
        <div className="msg" style={{marginTop:12}}>
          <span className="logoDot" style={{background:"#f59e0b"}}></span>
          <div>
            <b>Preparando demonstração…</b><br/>
            Na primeira visita a API pode demorar ~60s (free tier). Obrigado por aguardar!
          </div>
        </div>
      </div>
    </section>
  );
}

function PanelHeader({
  km_ini, setKmIni,
  windowM, setWindowM,
  onReload,
  onExportCSV, onPrintPDF,
  smooth, setSmooth
}) {
  return (
    <div className="demoHead">
      <div className="controls">
        <span className="chip">API base: <b>{API_BASE}</b></span>
        <span className="chip">Python proc: <b>{PROC_BASE}</b></span>
      </div>

      <div className="controls">
        <div className="seg" title="Navegar janela">
          <button onClick={()=>setKmIni(km_ini-100)}>−100 m</button>
          <button onClick={()=>setKmIni(km_ini+100)}>+100 m</button>
        </div>

        <div className="seg" title="Tamanho da janela">
          {[200,300,500].map(m=>(
            <button key={m}
              className={m===windowM ? "active":""}
              onClick={()=>setWindowM(m)}
            >{m} m</button>
          ))}
        </div>

        <label className="chip" style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" checked={smooth} onChange={e=>setSmooth(e.target.checked)} />
          Suavizar (Python)
        </label>

        <button className="btn" onClick={onExportCSV}>Exportar CSV</button>
        <button className="btn" onClick={onPrintPDF}>Salvar em PDF</button>
        <button className="btn" onClick={onReload} title="Recarregar agora">↻</button>
      </div>
    </div>
  );
}

function ChartBox({title, unit, data, yDomain, lineColor="#a78bfa"}) {
  return (
    <div className="chartCard">
      <div className="muted" style={{margin:"4px 6px 6px 6px"}}><b>{title}</b> {unit ? `(${unit})` : ""}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{top:8,right:16,left:0,bottom:12}}>
          <CartesianGrid stroke="#263154" strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            tick={{fill:"#9fb0d3"}}
            tickFormatter={(v)=>v.toFixed(0)}
            label={{value:"Distância na janela (m)", position:"insideBottom", offset:-4, fill:"#9fb0d3"}}
          />
          <YAxis
            domain={yDomain}
            tick={{fill:"#9fb0d3"}}
            tickFormatter={(v)=>v.toFixed( unit==="°" ? 1 : 0 )}
            width={50}
            label={{value: unit || "", angle:-90, position:"insideLeft", fill:"#9fb0d3"}}
          />
          <Tooltip
            contentStyle={{background:"#10172a",border:"1px solid #263154",borderRadius:10,color:"#e7ecff"}}
            formatter={(value)=> (unit==="°" ? value.toFixed(2) : value.toFixed(1)) + (unit || "")}
            labelFormatter={(l)=>`x ${l} m`}
          />
          <ReferenceLine y={0} stroke="#334155" />
          <Line type="monotone" dataKey="y" stroke={lineColor} strokeWidth={2.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Demo() {
  const [kmIni, setKmIni] = useState(333800);
  const [windowM, setWindowM] = useState(300);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState(null);
  const [smoothOn, setSmooth] = useState(true);
  const [error, setError] = useState("");

  const distance = useMemo(()=> raw?.series?.curvature?.map((_,i)=> i), [raw]);

  const baseSeries = useMemo(()=>{
    if (!raw) return null;
    const {curvature=[], crosslevel=[], gauge=[]} = raw.series || {};
    return {curvature, crosslevel, gauge};
  }, [raw]);

  const [series, setSeries] = useState({curvature:[], crosslevel:[], gauge:[]});

  // carregar dados
  async function loadData() {
    setLoading(true); setError("");
    try {
      const js = await getSegment(windowM, kmIni);
      setRaw(js);
    } catch (e) {
      setError("Falha ao carregar dados. Tente novamente em alguns segundos.");
    } finally {
      setLoading(false);
    }
  }

  // aplicar suavização quando liga/desliga ou quando chegam dados novos
  useEffect(()=>{
    let cancel=false;
    (async ()=>{
      if (!baseSeries) return;
      if (!smoothOn) { setSeries(baseSeries); return; }
      // suaviza crosslevel e bitola; curvatura geralmente já é derivada
      const [sl, sg] = await Promise.all([
        smoothPython(baseSeries.crosslevel, 11, 2),
        smoothPython(baseSeries.gauge,     11, 2),
      ]);
      if (!cancel) {
        setSeries({
          curvature: baseSeries.curvature,
          crosslevel: sl,
          gauge: sg
        });
      }
    })();
    return ()=>{ cancel=true; };
  }, [baseSeries, smoothOn]);

  useEffect(()=>{ loadData(); }, [kmIni, windowM]);

  const chartData = (arr) => (distance||[]).map((x,i)=>({x, y: arr?.[i] ?? null}));

  function exportCSV() {
    if (!raw) return;
    const rows = [["x_m","curvature_deg","crosslevel_mm","gauge_mm"]];
    const len = Math.max(series.curvature?.length||0, series.crosslevel?.length||0, series.gauge?.length||0);
    for (let i=0;i<len;i++){
      rows.push([
        i,
        series.curvature?.[i] ?? "",
        series.crosslevel?.[i] ?? "",
        series.gauge?.[i] ?? ""
      ]);
    }
    const label = `railsight_${windowM}m_km${fmtKm(kmIni/1000)}${smoothOn ? "_smooth" : ""}.csv`;
    csvDownload(label, rows);
  }

  function printPDF() { window.print(); }

  return (
    <section id="demo">
      <div className="card">
        <PanelHeader
          km_ini={kmIni} setKmIni={setKmIni}
          windowM={windowM} setWindowM={setWindowM}
          onReload={loadData}
          onExportCSV={exportCSV}
          onPrintPDF={printPDF}
          smooth={smoothOn} setSmooth={setSmooth}
        />
        {error && <div className="msg" style={{marginTop:10}}><span className="logoDot" style={{background:"#ef4444"}}></span><div>{error}</div></div>}
        {loading && !raw && <div className="msg" style={{marginTop:10}}><span className="logoDot" style={{background:"#f59e0b"}}></span><div>Carregando dados…</div></div>}

        {raw && (
          <>
            <div className="muted" style={{marginBottom:8}}>
              <b>Janela:</b> {windowM} m &nbsp;•&nbsp; <b>KM inicial (ref):</b> {fmtKm(kmIni/1000)}
            </div>

            <ChartBox
              title="Curvatura" unit="°"
              data={chartData(series.curvature)} yDomain={[-0.5, 3.1]} lineColor="#a78bfa"
            />
            <ChartBox
              title="Crosslevel" unit="mm"
              data={chartData(series.crosslevel)} yDomain={[-5, 15]} lineColor="#60a5fa"
            />
            <ChartBox
              title="Bitola" unit="mm"
              data={chartData(series.gauge)} yDomain={[1600-10, 1625+10]} lineColor="#34d399"
            />
          </>
        )}
      </div>
    </section>
  );
}

function Sections(){ 
  return (
    <>
      <section id="solucao" className="grid3">
        <div className="card">
          <div className="kicker"><span className="logoDot"></span> Solução</div>
          Transformamos dados de via em decisões: gráficos técnicos, janelas curtas e leitura intuitiva para priorizar manutenção.
        </div>
        <div className="card">
          <div className="kicker"><span className="logoDot"></span> Tecnologia</div>
          Frontend PWA; API escalável; microserviço Python para pré-processamento (suavização Savitzky–Golay).
        </div>
        <div className="card">
          <div className="kicker"><span className="logoDot"></span> Aplicação Geral</div>
          Carga e passageiros; núcleo é a geometria da via; mensagem adapta ao negócio.
        </div>
      </section>

      <section id="beneficios" className="card" style={{marginTop:12}}>
        <div className="kicker"><span className="logoDot"></span> Benefícios</div>
        ✓ Segurança operacional • ✓ Disponibilidade da via • ✓ Redução de custos • ✓ Acesso web e celular • ✓ Escalabilidade e integração
      </section>

      <Demo/>

      <footer id="contato">
        RailSight é uma solução da <b>Data Tech — Soluções em I.A.</b> • contato@datatech.com • WhatsApp: (32) 99141-3852
      </footer>
    </>
  );
}

function App(){
  useEffect(()=>{
    // scroll suave ao clicar Entrar na Demo
    const btn = document.getElementById("go-demo");
    const go = (e)=>{ e?.preventDefault?.(); document.getElementById("demo")?.scrollIntoView({behavior:"smooth"}); };
    if (btn) btn.addEventListener("click", go);
    return ()=> btn && btn.removeEventListener("click", go);
  },[]);
  return (
    <>
      <Hero onGo={()=>document.getElementById("demo")?.scrollIntoView({behavior:"smooth"})}/>
      <Sections/>
    </>
  );
}

const root = createRoot(document.getElementById("app"));
root.render(<App />);
