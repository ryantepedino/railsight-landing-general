// server/index.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.API_KEY || "troque-esta-chave";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --- API KEY simple auth ---
app.use((req, res, next) => {
  const key = req.header("x-api-key");
  if (key !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

const DATA_DIR = path.join(__dirname, "data");
await fs.ensureDir(DATA_DIR);

const upload = multer({ storage: multer.memoryStorage() });

// ===== Helpers =====
function safeCampaignId(name) {
  return String(name || "Campanha").replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}
function toNumber(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}
function readCsvOrJson(buf, filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "json") {
    const j = JSON.parse(buf.toString("utf8"));
    return { type: "json", data: j };
  }
  // CSV esperado: km_abs_m,curv,xlev,twist,warp,gage
  const rows = parse(buf.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return { type: "csv", data: rows };
}

function qualityCheck(rows) {
  const report = {
    ok: true,
    issues: [],
    stats: {},
  };
  if (!rows.length) {
    report.ok = false;
    report.issues.push("Arquivo vazio.");
    return report;
  }
  // headers mínimos
  const need = ["km_abs_m", "curv", "xlev", "gage"];
  for (const h of need) {
    if (!(h in rows[0])) {
      report.ok = false;
      report.issues.push(`Coluna obrigatória ausente: ${h}`);
    }
  }
  // amostragem (passo)
  const kms = rows
    .map((r) => toNumber(r.km_abs_m))
    .filter((v) => v != null)
    .sort((a, b) => a - b);
  if (kms.length < 2) {
    report.ok = false;
    report.issues.push("Poucos pontos (km_abs_m).");
  } else {
    const diffs = [];
    for (let i = 1; i < kms.length; i++) diffs.push(kms[i] - kms[i - 1]);
    const mean =
      diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
    const min = Math.min(...diffs);
    const max = Math.max(...diffs);
    report.stats.sample_step_m = Number(mean.toFixed(3));
    if (min < 0) {
      report.ok = false;
      report.issues.push("Sequência de km não monotônica.");
    }
    // alerta se passo médio fugir muito de 1 m
    if (mean < 0.5 || mean > 2.5) {
      report.issues.push(
        `Passo médio fora do esperado (≈1m): ${mean.toFixed(3)} m`
      );
    }
  }
  // sanidade de faixas
  const gageVals = rows
    .map((r) => toNumber(r.gage))
    .filter((v) => v != null);
  if (gageVals.length) {
    const gmin = Math.min(...gageVals);
    const gmax = Math.max(...gageVals);
    report.stats.gage_min = gmin;
    report.stats.gage_max = gmax;
    if (gmin < 1400 || gmax > 1700) {
      report.issues.push(
        `Gauge com valores atípicos (min=${gmin}, max=${gmax})`
      );
    }
  }
  return report;
}

function normalizeRows(rows) {
  // retorna arrays paralelos
  const km_abs_m = [];
  const curv = [];
  const xlev = [];
  const rate = []; // pode ser nulo (calculamos na frente)
  const twist = [];
  const warp = [];
  const gage = [];
  for (const r of rows) {
    km_abs_m.push(toNumber(r.km_abs_m));
    curv.push(toNumber(r.curv));
    xlev.push(toNumber(r.xlev));
    rate.push(toNumber(r.rate)); // pode vir vazio
    twist.push(toNumber(r.twist));
    warp.push(toNumber(r.warp));
    gage.push(toNumber(r.gage));
  }
  return { km_abs_m, curv, xlev, rate, twist, warp, gage };
}

function computeRateFromXlev(arr, stepM = 1) {
  const out = Array(arr.length).fill(null);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i] = prev == null || v == null ? null : (v - prev) / stepM;
    prev = v;
  }
  return out;
}

async function saveCampaign(id, payload) {
  const campDir = path.join(DATA_DIR, id);
  await fs.ensureDir(campDir);
  const file = path.join(campDir, "data.json");
  await fs.writeJSON(file, payload, { spaces: 2 });
}

async function loadCampaign(id) {
  const file = path.join(DATA_DIR, id, "data.json");
  if (!(await fs.pathExists(file))) return null;
  return fs.readJSON(file);
}

async function listCampaigns() {
  const dirs = await fs.readdir(DATA_DIR);
  const out = [];
  for (const d of dirs) {
    const file = path.join(DATA_DIR, d, "data.json");
    if (await fs.pathExists(file)) out.push(d);
  }
  return out;
}

// ===== Endpoints =====

// 1) Campanhas disponíveis
app.get("/campaigns", async (req, res) => {
  const campaigns = await listCampaigns();
  res.json({ campaigns });
});

// 2) Upload (um ou mais arquivos)
app.post("/upload", upload.array("file"), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: "Nenhum arquivo recebido." });
  }
  const results = [];
  for (const f of req.files) {
    try {
      const { data } = readCsvOrJson(f.buffer, f.originalname);

      // Se JSON for array simples, aceita; se for objeto com "rows", aceita também
      const rows =
        Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : null;
      if (!rows) {
        results.push({
          filename: f.originalname,
          ok: false,
          error: "Formato inválido. Use CSV com cabeçalhos ou JSON array.",
        });
        continue;
      }

      const qc = qualityCheck(rows);
      const norm = normalizeRows(rows);
      // Deriva rate se faltar
      if (!norm.rate.some((v) => v != null) && norm.xlev.some((v) => v != null)) {
        norm.rate = computeRateFromXlev(norm.xlev, 1);
      }

      // Campaign Id: usa nome do arquivo sem extensão
      const base = f.originalname.replace(/\.[^.]+$/, "");
      const id = safeCampaignId(base);

      await saveCampaign(id, {
        campaign: id,
        ...norm,
        meta: { uploadedAt: Date.now(), filename: f.originalname, quality: qc },
      });

      results.push({
        filename: f.originalname,
        ok: qc.ok,
        campaign: id,
        quality: qc,
      });
    } catch (e) {
      results.push({ filename: f.originalname, ok: false, error: String(e) });
    }
  }
  res.json({ results });
});

// 3) Segmento por campanha (janela por KM absoluto, em metros)
app.get("/segment", async (req, res) => {
  const campaign = safeCampaignId(req.query.campaign);
  const ref_km = Number(req.query.ref_km || 0); // ex: 333800
  const len = Number(req.query.len || 2000); // metros
  const step = Number(req.query.step || 1); // 1 m

  const camp = await loadCampaign(campaign);
  if (!camp) return res.status(404).json({ error: "campaign_not_found" });

  const start = ref_km;
  const end = ref_km + len;

  const out = {
    km_abs_m: [],
    curv: [],
    xlev: [],
    rate: [],
    twist: [],
    warp: [],
    gage: [],
  };

  for (let i = 0; i < camp.km_abs_m.length; i++) {
    const m = camp.km_abs_m[i];
    if (m == null) continue;
    if (m >= start && m <= end) {
      out.km_abs_m.push(m);
      out.curv.push(camp.curv[i] ?? null);
      out.xlev.push(camp.xlev[i] ?? null);
      out.rate.push(camp.rate[i] ?? null);
      out.twist.push(camp.twist[i] ?? null);
      out.warp.push(camp.warp[i] ?? null);
      out.gage.push(camp.gage[i] ?? null);
    }
  }

  res.json(out);
});

// 4) Export CSV (simples) — toda a campanha
app.post("/export", async (req, res) => {
  const { campaign } = req.body || {};
  const id = safeCampaignId(campaign);
  const camp = await loadCampaign(id);
  if (!camp) return res.status(404).send("campaign_not_found");

  const headers = ["km_abs_m", "curv", "xlev", "rate", "twist", "warp", "gage"];
  const lines = [headers.join(",")];
  for (let i = 0; i < camp.km_abs_m.length; i++) {
    const row = headers
      .map((h) => (camp[h] && camp[h][i] != null ? camp[h][i] : ""))
      .join(",");
    lines.push(row);
  }
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${id}.csv"`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`API Data Tech pronta em http://localhost:${PORT}`);
  console.log(`Use x-api-key: ${API_KEY}`);
});
