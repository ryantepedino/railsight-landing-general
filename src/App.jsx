// src/App.jsx
import React, {
  useEffect, useMemo, useState, useRef, createContext, useContext
} from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, ReferenceLine, ReferenceArea, Tooltip, Legend, Brush,
  Scatter, BarChart, Bar
} from "recharts";

import { loadCampaignFile, mergeByKm, exportCSV } from "./lib/uploader";
import { getCampaigns } from "./lib/api"; // por enquanto só lemos /campaigns

/* ========================= CONFIG / NORMAS ========================= */

const PALETTE = ["#7c3aed","#10b981","#60a5fa","#f59e0b","#ef4444","#22d3ee","#e879f9"];

const LIMITS = {
  curv:  {
    unit:"1/m", yDomain:[0,8],
    lines:[{y:6,color:"#f59e0b",label:"Alerta UIC 518"},{y:8,color:"#ef4444",label:"Limite UIC 518"}],
    standard: "UIC 518"
  },
  xlev:  {
    unit:"mm", yDomain:[-40,40],
    lines:[{y:25,color:"#f59e0b",label:"Alerta ANTT"},{y:-25,color:"#f59e0b",label:"Alerta ANTT"}],
    bands:[{y1:-15,y2:15,fill:"rgba(34,197,94,0.06)"}],
    standard: "ANTT"
  },
  rate:  {
    unit:"mm/m", yDomain:[-20,20],
    lines:[{y:10,color:"#f59e0b",label:"Alerta ANTT"},{y:-10,color:"#f59e0b",label:"Alerta ANTT"}],
    bands:[{y1:-7,y2:7,fill:"rgba(34,197,94,0.06)"}],
    standard: "ANTT"
  },
  twist: {
    unit:"mm", yDomain:[-10,10],
    lines:[{y:6,color:"#f59e0b",label:"Alerta ANTT"},{y:-6,color:"#f59e0b",label:"Alerta ANTT"}],
    standard: "ANTT"
  },
  warp:  {
    unit:"mm", yDomain:[-5,5],
    lines:[{y:3,color:"#f59e0b",label:"Alerta ANTT"},{y:-3,color:"#f59e0b",label:"Alerta ANTT"}],
    standard: "ANTT"
  },
  gage:  {
    unit:"mm", yDomain:[1590,1620],
    lines:[{y:1595,color:"#f59e0b",label:"Faixa UIC 518"},{y:1615,color:"#f59e0b",label:"Faixa UIC 518"}],
    tickFmt:(v)=>Math.round(v).toString(),
    standard: "UIC 518"
  }
};

const FIELDS = ["curv","xlev","rate","twist","warp","gage"];

/* ========================= UTILS / CONTEXTOS ========================= */

const fmtKM = (v) => `${Math.floor(v)}+${String(Math.round((v%1)*1000)).padStart(3,"0")}`;
const nice  = (v,d=2) => (v==null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));

const CursorCtx = createContext({ x:null, setX:()=>{} });
const useCursor = () => useContext(CursorCtx);

const SelectCtx = createContext({ km:null, setKm:()=>{} });
const useSelect = () => useContext(SelectCtx);

/* ========================= PROCESSAMENTO ========================= */

function computeRateFromXlev(rows, campaign, stepM = 1){
  let prev = null;
  for (let i=0;i<rows.length;i++){
    const v = rows[i][`xlev_${campaign}`];
    rows[i][`rate_${campaign}`] = (prev==null || v==null) ? null : (v - prev)/stepM;
    prev = v;
  }
  return rows;
}

function getAllowedRange(lim) {
  if (!lim?.lines?.length) return null;
  const ys = lim.lines.map(l => l.y).sort((a,b)=>a-b);
  if (ys.length >= 2) return [ys[0], ys[ys.length - 1]];
  return [Number.NEGATIVE_INFINITY, ys[0]];
}

function buildAlarms(data, campaigns) {
  const rows = [];
  for (const f of FIELDS) {
    const lim = LIMITS[f];
    const range = getAllowedRange(lim);
    if (!range) continue;
    const [low, high] = range;
    for (const c of campaigns) {
      const key = `${f}_${c}`;
      for (let i=0;i<data.length;i++){
        const v = data[i][key];
        if (v==null || Number.isNaN(v)) continue;
        const isOut = v < low || v > high;
        if (!isOut) continue;
        const dist = (v > high) ? (v - high) : (low - v);
        const sev = dist >  (f==="gage" ? 5 : (f==="curv"? 1.0 : 2.0)) ? "ALARM" : "WARN";
        rows.push({
          km: data[i].km,
          field: f,
          campaign: c,
          value: v,
          unit: LIMITS[f].unit,
          standard: LIMITS[f].standard || "-",
          severity: sev
        });
      }
    }
  }
  const order = { "ALARM":0, "WARN":1 };
  rows.sort((a,b)=>{
    const ds = (order[a.severity] - order[b.severity]);
    if (ds!==0) return ds;
    if (a.field!==b.field) return a.field.localeCompare(b.field);
    return a.km - b.km;
  });
  return rows;
}

function countAlarmsByCampaign(alarms, campaigns){
  const result = campaigns.map(c => ({ campaign:c, WARN:0, ALARM:0 }));
  const idx = Object.fromEntries(result.map((r,i)=>[r.campaign,i]));
  for (const a of alarms) {
    const i = idx[a.campaign];
    if (i==null) continue;
    result[i][a.severity] = (result[i][a.severity] || 0) + 1;
  }
  return result;
}

function makeCriticalPoints(data, field, campaigns, limits) {
  const range = getAllowedRange(limits) || [-Infinity, Infinity];
  const [low, high] = range;
  const out = {};
  for (const c of campaigns) {
    const key = `${field}_${c}`;
    const pts = [];
    for (const row of data) {
      const v = row[key];
      if (typeof v !== "number" || Number.isNaN(v)) continue;
      if (v < low || v > high) pts.push({ km: row.km, y: v });
    }
    out[c] = pts;
  }
  return out;
}

/* ========== DEMO (até termos /segment do backend) ========== */

function makeDemoSeries(campaignId, phase = 0){
  return Array.from({length:1200},(_,i)=>{
    const km = +(333.8 + i*0.001).toFixed(3);
    const w = (t)=>Math.sin(t+phase);
    const v = (t)=>Math.cos(t+phase);
    return {
      km,
      [`curv_${campaignId}`] : 2 + w(i/20)*2,
      [`xlev_${campaignId}`] : -20 + w(i/30)*15,
      [`rate_${campaignId}`] : w(i/18)*8,
      [`twist_${campaignId}`]: w(i/25)*5,
      [`warp_${campaignId}`] : v(i/40)*2,
      [`gage_${campaignId}`] : 1600 + w(i/50)*12
    };
  });
}

/* ========================= RELATÓRIO EXECUTIVO (com logo/cliente/trecho) ========================= */

function generateExecutiveReport(data, campaigns, opts = {}) {
  const {
    client = "(nome da ferrovia)",
    trecho = "km 333+800 ao km 334+900",
    logoUrl = "/logo_datatech.png",
  } = opts;

  const now = new Date().toLocaleString();
  const alarms = buildAlarms(data, campaigns);
  const counts = countAlarmsByCampaign(alarms, campaigns);

  // === capa com logo + cliente + trecho ===
  const cover = `
    <section style="page-break-after:always">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${logoUrl}" alt="Data Tech" style="height:42px;border-radius:6px;box-shadow:0 0 6px rgba(0,0,0,.12)" onerror="this.style.display='none'"/>
          <h1 style="margin:0;font-family:Arial,sans-serif">RailSight — Data Tech</h1>
        </div>
        <div style="font-size:12px;color:#444">Gerado em ${now}</div>
      </div>

      <div style="font-size:18px;margin:6px 0 12px 0"><b>Relatório Executivo</b></div>
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%">
        <tr><td style="width:20%;background:#f5f7fb"><b>Cliente</b></td><td>${client}</td></tr>
        <tr><td style="background:#f5f7fb"><b>Trecho analisado</b></td><td>${trecho}</td></tr>
        <tr><td style="background:#f5f7fb"><b>Campanhas</b></td><td>${campaigns.join(", ")||"—"}</td></tr>
      </table>

      <div style="margin:16px 0 6px 0;font-size:13px;color:#333">
        Sumário de excedências normativas por canal (UIC/ANTT) e tabelas executivas para manutenção.
      </div>
    </section>
  `;

  const summary = `
    <section style="page-break-after:always">
      <h2 style="font-family:Arial,sans-serif;margin:0 0 10px 0">Sumário</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;width:100%">
        <thead style="background:#f3f4f6">
          <tr><th style="text-align:left">Campanha</th><th>WARN</th><th>ALARM</th></tr>
        </thead>
        <tbody>
          ${counts.map(r=>`
            <tr>
              <td>${r.campaign}</td>
              <td style="text-align:center">${r.WARN}</td>
              <td style="text-align:center">${r.ALARM}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="margin-top:10px;color:#333">Conclusão: ${alarms.length ? "Há pontos fora de norma que requerem inspeção/manutenção." : "Não foram detectadas excedências nas campanhas informadas."}</p>
    </section>
  `;

  // === mini-gráficos por canal para impressão (renderizados como SVG estático) ===
  // Vamos gerar “sparklines” simples com base em uma única campanha visível (ou primeira).
  const refCampaign = campaigns[0];
  const labels = [
    { key:"curv",  label:"CURV (1/m)",  unit: LIMITS.curv.unit,  limit: LIMITS.curv },
    { key:"xlev",  label:"XLEV (mm)",   unit: LIMITS.xlev.unit,  limit: LIMITS.xlev },
    { key:"rate",  label:"RATE (mm/m)", unit: LIMITS.rate.unit,  limit: LIMITS.rate },
    { key:"twist", label:"TWIST (mm)",  unit: LIMITS.twist.unit, limit: LIMITS.twist },
    { key:"warp",  label:"WARP (mm)",   unit: LIMITS.warp.unit,  limit: LIMITS.warp },
    { key:"gage",  label:"GAGE (mm)",   unit: LIMITS.gage.unit,  limit: LIMITS.gage },
  ];

  function minmax(arr){ let mn=+Infinity,mx=-Infinity; for(const x of arr){ if(typeof x==="number"&&!Number.isNaN(x)){ if(x<mn) mn=x; if(x>mx) mx=x; } } return [mn,mx]; }
  function sparkline(rows, fieldKey) {
    const W = 420, H = 110, L=28, R=12, T=12, B=22;
    const w = W - L - R, h = H - T - B;
    const xs = rows.map(r=>r.km);
    const ys = rows.map(r=>r[fieldKey]);
    const [xmin,xmax] = minmax(xs); const [ymin,ymax] = minmax(ys);
    if(!Number.isFinite(xmin)||!Number.isFinite(xmax)||!Number.isFinite(ymin)||!Number.isFinite(ymax)) {
      return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"></svg>`;
    }
    const sx = x => L + ( (x-xmin)/(xmax-xmin) ) * w;
    const sy = y => T + (1 - ( (y - ymin)/(ymax-ymin||1) )) * h;

    let d=""; let first=true;
    for(let i=0;i<rows.length;i++){
      const v = rows[i][fieldKey];
      if(typeof v !== "number" || Number.isNaN(v)) continue;
      const x = sx(rows[i].km), y = sy(v);
      d += (first ? `M${x},${y}` : ` L${x},${y}`); first=false;
    }

    return `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="border:1px solid #e5e7eb;border-radius:8px">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <g font-family="Arial" font-size="10" fill="#111">
        <text x="${L}" y="12" font-size="11" font-weight="700">${fieldKey.toUpperCase()}</text>
      </g>
      <path d="${d}" fill="none" stroke="#6b5cff" stroke-width="2"/>
      <line x1="${L}" y1="${T+h/2}" x2="${L+w}" y2="${T+h/2}" stroke="#e5e7eb"/>
      <g font-family="Arial" font-size="9" fill="#666">
        <text x="${L}" y="${H-6}">${fmtKM(xmin)}</text>
        <text x="${W-R-40}" y="${H-6}" text-anchor="end">${fmtKM(xmax)}</text>
      </g>
    </svg>`;
  }

  const seriesByCampaign = {};
  for(const c of campaigns){
    const keyed = data.map(r => ({ km:r.km, ...FIELDS.reduce((o,f)=>{ o[`${f}_${c}`]=r[`${f}_${c}`]; return o; },{}) }));
    seriesByCampaign[c] = keyed;
  }
  const rowsRef = refCampaign ? seriesByCampaign[refCampaign] : [];

  const charts = `
    <section style="page-break-after:always">
      <h2 style="font-family:Arial,sans-serif;margin:0 0 10px 0">Gráficos (compactos para impressão)</h2>
      ${labels.map(l=>{
        const key = `${l.key}_${refCampaign}`;
        return `
          <div style="margin:8px 0 16px 0">
            <div style="font:12px Arial;margin:2px 0 4px 0"><b>${l.label}</b> <span style="color:#667085">• ${l.limit.standard}</span></div>
            ${sparkline(rowsRef || [], key)}
          </div>
        `;
      }).join("")}
    </section>
  `;

  const defectTable = `
    <section>
      <h2 style="font-family:Arial,sans-serif;margin:0 0 10px 0">Tabela de Defeitos Normativos</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;width:100%">
        <thead style="background:#f3f4f6">
          <tr>
            <th style="text-align:left">KM</th><th>Canal</th><th>Campanha</th>
            <th>Valor</th><th>Unid</th><th>Norma</th><th>Severidade</th>
          </tr>
        </thead>
        <tbody>
          ${alarms.map(a=>`
            <tr>
              <td>${fmtKM(a.km)}</td>
              <td>${a.field}</td>
              <td>${a.campaign}</td>
              <td style="text-align:right">${nice(a.value,3)}</td>
              <td>${a.unit}</td>
              <td>${a.standard}</td>
              <td style="text-align:center">${a.severity}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div style="margin-top:16px;font:12px Arial;color:#555">
        <div><b>Responsável técnico:</b> Data Tech • RailSight</div>
        <div style="margin-top:4px">Contato: datatechinfo19@gmail.com • WhatsApp (32) 99141-3852</div>
      </div>
    </section>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Relatório Executivo — RailSight</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          @media print { @page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: Arial, sans-serif; color:#111; }
          h1,h2 { color:#0b1b3a }
        </style>
      </head>
      <body>
        ${cover}
        ${summary}
        ${charts}
        ${defectTable}
        <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
      </body>
    </html>
  `);
  win.document.close();
}

/* ========================= TOOLTIP / PLOT COMPONENTS ========================= */

function makeTooltip(label, campaigns, field, unit){
  return ({active, payload, label: xval})=>{
    if(!active) return null;
    return (
      <div style={{background:"#0f172a",border:"1px solid #223048",borderRadius:10,padding:10,fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:6}}>{label} — km {fmtKM(xval)}</div>
        {campaigns.map((c,i)=>{
          const k = `${field}_${c}`;
          const pv = payload?.find(p=>p.dataKey===k)?.value;
          if(pv==null) return null;
          return (
            <div key={k} style={{display:"flex",justifyContent:"space-between",gap:8}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                <span style={{width:10,height:10,background:PALETTE[i%PALETTE.length],borderRadius:2}}/>
                {c}
              </span>
              <span>{nice(pv,3)} {unit}</span>
            </div>
          );
        })}
      </div>
    );
  };
}

function Pane({ title, field, campaigns, data, limits, kmMarks = [], onBrushChange }) {
  const { x, setX } = useCursor();
  const { km: selKm, setKm } = useSelect() || { km:null, setKm:()=>{} };
  const tooltip = useMemo(()=> makeTooltip(title, campaigns, field, limits.unit), [campaigns,field,title,limits.unit]);
  const crit = useMemo(()=> makeCriticalPoints(data, field, campaigns, limits), [data,field,campaigns,limits]);

  return (
    <div className="card">
      <div className="card-title">
        {title} <span className="muted">({limits.unit})</span>
        {limits?.standard && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>• {limits.standard}</span>}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          syncId="railstack"
          onMouseMove={(e) => { if (e && e.activeLabel != null) setX(e.activeLabel); }}
          onMouseLeave={() => setX(null)}
          margin={{ left: 40, right: 16, top: 10, bottom: 8 }}
        >
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="km" tick={{ fill:"#9fb4d9", fontSize:12 }} stroke="#4b5563" tickFormatter={fmtKM}/>
          <YAxis domain={limits.yDomain ?? ["auto","auto"]} tick={{ fill:"#9fb4d9", fontSize:12 }} stroke="#4b5563" width={54} tickFormatter={limits.tickFmt}/>
          {limits.bands?.map((b,i)=>(<ReferenceArea key={i} y1={b.y1} y2={b.y2} fill={b.fill} ifOverflow="hidden" />))}
          {limits.lines?.map((L,i)=>(<ReferenceLine key={i} y={L.y} stroke={L.color} strokeDasharray="6 6" />))}
          {kmMarks.map((km,i)=>(<ReferenceLine key={`m${i}`} x={km} stroke="#ef4444" strokeDasharray="6 6" />))}
          {x!=null && <ReferenceLine x={x} stroke="#94a3b8" strokeDasharray="2 2" />}
          {selKm!=null && <ReferenceLine x={selKm} stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" />}

          {campaigns.map((c,i)=>(
            <Line key={`${field}_${c}`} type="monotone" dataKey={`${field}_${c}`} name={`${c}`}
                  stroke={PALETTE[i%PALETTE.length]} strokeWidth={2} dot={false} isAnimationActive={false}/>
          ))}

          {campaigns.map((c)=>(
            <Scatter key={`crit_${field}_${c}`} data={crit[c]} x="km" y="y" shape="circle" fill="#ef4444" stroke="#ef4444"
              onClick={(pt)=>{ try { setKm?.(pt?.payload?.km); } catch {} }} />
          ))}

          <Tooltip content={tooltip}/>
          <Legend verticalAlign="bottom" height={20} wrapperStyle={{ color:"#cdd8ee" }} />
          <Brush dataKey="km" height={10} stroke="#6b7280" travellerWidth={8}
            onChange={(r)=> onBrushChange?.(r?.startIndex ?? 0, r?.endIndex ?? (data.length-1))}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ counts }) {
  return (
    <div className="card">
      <div className="card-title">Tendência — Nº de Alarmes por Campanha</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={counts} margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="campaign" tick={{ fill:"#9fb4d9", fontSize:12 }} stroke="#4b5563" />
          <YAxis tick={{ fill:"#9fb4d9", fontSize:12 }} stroke="#4b5563" allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ color:"#cdd8ee" }} />
          <Bar dataKey="WARN" name="WARN" />
          <Bar dataKey="ALARM" name="ALARM" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlarmTable({ alarms, onJump }) {
  return (
    <div className="card alarms">
      <div className="card-title">Tabela de Defeitos Normativos</div>
      <div className="thead">
        <div>KM</div><div>Canal</div><div>Campanha</div><div>Valor</div><div>Unid</div><div>Norma</div><div>Sev</div>
      </div>
      {alarms.map((a,idx)=>(
        <div key={idx} className={`row ${a.severity==="ALARM"?"alarm":"warn"}`} onClick={()=>onJump?.(a.km)} title="Clique para focar no gráfico">
          <div>{fmtKM(a.km)}</div>
          <div>{a.field}</div>
          <div>{a.campaign}</div>
          <div>{nice(a.value,3)}</div>
          <div>{a.unit}</div>
          <div>{a.standard}</div>
          <div>{a.severity}</div>
        </div>
      ))}
    </div>
  );
}

/* ========================= APP ========================= */

export default function App(){
  const [campaigns, setCampaigns] = useState([]);    // vindas do backend
  const [enabled,   setEnabled]   = useState({});    // toggle por campanha
  const [series,    setSeries]    = useState([]);    // dados mesclados por km
  const [selKm, setSelKm] = useState(null);          // seleção cruzada tabela ↔ gráfico
  const lastBrush = useRef({ start:0, end:null });   // janela p/ CSV
  const [client, setClient] = useState("Cliente Demo");
  const [trecho, setTrecho] = useState("km 333+800 ao km 334+900");

  const [x,setX] = useState(null);
  const cursorCtx = useMemo(()=>({x,setX}),[x]);

  const fileRef = useRef(null);

  // Carrega campanhas (se não houver, cai em DEMO) e gera séries de onda enquanto /segment não existe.
  useEffect(()=>{
    let dead = false;
    (async ()=>{
      try{
        const j = await getCampaigns(); // { campaigns: [...] }
        if (dead) return;
        const list = j?.campaigns ?? [];
        if (!list.length) throw new Error("no campaigns");

        const waves = list.map((c,idx)=> makeDemoSeries(c, idx*0.7));
        const merged = mergeByKm(waves);
        for (const c of list) {
          const hasRate = merged.some(r => r[`rate_${c}`] != null);
          if (!hasRate) computeRateFromXlev(merged, c, 1);
        }

        setCampaigns(list);
        setEnabled(Object.fromEntries(list.map(c=>[c,true])));
        setSeries(merged);
      }catch(e){
        const demo = makeDemoSeries("Demo", 0);
        setCampaigns(["Demo"]);
        setEnabled({ Demo:true });
        setSeries(demo);
      }
    })();
    return ()=>{ dead = true; };
  },[]);

  // Upload local (sem backend de upload ainda)
  async function handleImport(e){
    const files = [...(e.target?.files ?? [])];
    if(!files.length) return;

    const loaded = await Promise.all(files.map(f => loadCampaignFile(f)));
    let merged = mergeByKm([...(series.length? [series] : []), ...loaded.map(l => l.rows)]);
    for (const l of loaded) {
      const c = l.campaignId;
      const hasRate = merged.some(r => r[`rate_${c}`] != null);
      if(!hasRate) merged = computeRateFromXlev(merged, c, 1);
    }
    setSeries(merged);
    loaded.forEach(l=>{
      setCampaigns(c=>[...new Set([...c, l.campaignId])]);
      setEnabled(s=>({...s,[l.campaignId]:true}));
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function visibleCampaigns(){ return campaigns.filter(c => enabled[c]); }
  const vis  = visibleCampaigns();
  const alarms = useMemo(()=> buildAlarms(series, vis), [series, vis]);
  const trend  = useMemo(()=> countAlarmsByCampaign(alarms, vis), [alarms, vis]);

  function onExportCSV(){
    const { start, end } = lastBrush.current;
    exportCSV(series, vis, start, end);
  }

  function jumpToKm(km){
    setX(km);
    const el = document.querySelector(".content");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <SelectCtx.Provider value={useMemo(()=>({ km: selKm, setKm: setSelKm }), [selKm])}>
      <CursorCtx.Provider value={cursorCtx}>
        <div className="page">
          <header className="hero print-hide">
            <div className="brand">RailSight — <b>Data Tech</b></div>
            <div className="subtitle">
              Curvatura, Crosslevel, Rate, Twist, Warp, Gauge — <b>múltiplas campanhas</b>, limites normativos, marcadores, tabela, PDF/CSV.
            </div>

            <div className="toolbar">
              <div className="campaigns">
                {campaigns.map((c,i)=>(
                  <button
                    key={c}
                    className="pill"
                    onClick={()=>setEnabled(s=>({...s,[c]:!s[c]}))}
                    style={{borderColor: PALETTE[i%PALETTE.length], opacity: enabled[c] ? 1 : 0.35}}
                    title={enabled[c] ? "Ocultar": "Mostrar"}
                  >
                    <span className="dot" style={{background:PALETTE[i%PALETTE.length]}}/>
                    {c}
                  </button>
                ))}
              </div>

              <div className="actions" style={{rowGap:8}}>
                <div className="mini">
                  <input
                    value={client}
                    onChange={(e)=>setClient(e.target.value)}
                    placeholder="Cliente (aparece no PDF)"
                    className="inp"
                  />
                  <input
                    value={trecho}
                    onChange={(e)=>setTrecho(e.target.value)}
                    placeholder="Trecho analisado (aparece no PDF)"
                    className="inp"
                  />
                </div>

                <input ref={fileRef} type="file" accept=".csv,.json" multiple onChange={handleImport} style={{ display: "none" }} />
                <button className="btn" onClick={()=>fileRef.current?.click()}>Importar campanhas</button>
                <button className="btn" onClick={()=>window.print()}>Salvar PDF (gráficos)</button>
                <button className="btn" onClick={onExportCSV}>Exportar CSV</button>
                <button className="btn" onClick={()=>generateExecutiveReport(series, vis, { client, trecho, logoUrl:"/logo_datatech.png" })}>Relatório Executivo PDF</button>
              </div>
            </div>
          </header>

          <main className="content">
            <TrendChart counts={trend} />

            <Pane title="Curvatura"       field="curv"  campaigns={vis} data={series} limits={LIMITS.curv}  kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>
            <Pane title="Crosslevel"      field="xlev"  campaigns={vis} data={series} limits={LIMITS.xlev}  kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>
            <Pane title="Crosslevel Rate" field="rate"  campaigns={vis} data={series} limits={LIMITS.rate}  kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>
            <Pane title="Twist"           field="twist" campaigns={vis} data={series} limits={LIMITS.twist} kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>
            <Pane title="Warp"            field="warp"  campaigns={vis} data={series} limits={LIMITS.warp}  kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>
            <Pane title="Gauge"           field="gage"  campaigns={vis} data={series} limits={LIMITS.gage}  kmMarks={[333.950]} onBrushChange={(s,e)=> (lastBrush.current={start:s,end:e})}/>

            <AlarmTable alarms={alarms} onJump={jumpToKm} />
          </main>

          <footer className="footer print-hide">
            RailSight © Data Tech — datatechinfo19@gmail.com — WhatsApp (32) 99141-3852
          </footer>
        </div>

        <style>{`
          :root{ color-scheme:dark }
          body{ margin:0; background:#0b0f16; color:#e5e7eb; font-family:Inter,system-ui,sans-serif }
          .page{ max-width:1280px; margin:0 auto; padding:16px }
          .hero{ background:#0f1420; border:1px solid #182235; border-radius:16px; padding:16px; margin-bottom:14px }
          .brand{ font-size:22px; font-weight:800 }
          .subtitle{ color:#9aa7bf; margin-top:6px }
          .toolbar{ display:flex; gap:12px; align-items:flex-start; justify-content:space-between; margin-top:10px; flex-wrap:wrap }
          .campaigns{ display:flex; gap:8px; flex-wrap:wrap }
          .pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; background:#0b1220; border:1px solid #243048; color:#e9efff }
          .pill .dot{ width:10px; height:10px; border-radius:50% }
          .actions{ display:flex; gap:8px; flex-wrap:wrap }
          .btn{ padding:8px 12px; border-radius:10px; border:1px solid #243048; background:#111a2a; color:#e9efff; font-weight:600; cursor:pointer }
          .content{ display:flex; flex-direction:column; gap:14px }
          .card{ background:#0f1420; border:1px solid #182235; border-radius:14px; padding:12px }
          .card-title{ font-weight:700; margin:2px 4px 8px 4px; display:flex; align-items:center; gap:6px }
          .muted{ color:#9aa7bf }
          .footer{ text-align:center; color:#93a3c4; margin:12px 0 24px }

          .alarms .thead, .alarms .row{
            display:grid; grid-template-columns: 110px 80px 110px 90px 60px 120px 70px;
            gap:8px; align-items:center }
          .alarms .thead{ font-weight:700; color:#cdd8ee; padding:6px 8px; border-bottom:1px solid #182235 }
          .alarms .row{ background:#0d1320; border:1px solid #182235; margin:6px 0; padding:8px; border-radius:10px; text-align:left; color:#e5e7eb; cursor:pointer; }
          .alarms .row:hover{ background:#0f172a }
          .alarms .row.alarm{ border-color:#ef4444 }
          .alarms .row.warn { border-color:#f59e0b }

          .mini{ display:flex; gap:8px; flex-wrap:wrap; align-items:center }
          .inp{ background:#0b1220; color:#e9efff; border:1px solid #243048; border-radius:10px; padding:6px 10px; min-width:220px }

          @media print{
            body{ background:#fff; color:#111 }
            .print-hide, .recharts-brush{ display:none !important }
            .page{ max-width:none; padding:0 }
            .card{ page-break-inside:avoid; border:0; }
            .recharts-default-legend{ display:none !important }
            .footer{ display:none !important }
          }
        `}</style>
      </CursorCtx.Provider>
    </SelectCtx.Provider>
  );
}
