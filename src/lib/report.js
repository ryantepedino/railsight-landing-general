// src/lib/report.js
// Gera um PDF profissional com capa, sumário, gráficos (como imagens) e conclusões
// Depende de: jspdf e html2canvas (já instalados)

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/* =========================
   Helpers visuais
========================= */
function header(doc, title = "RailSight — Data Tech") {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 14, 16);
  doc.setDrawColor(120, 120, 120);
  doc.line(14, 18, 200, 18);
}

function footer(doc, page, total) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Página ${page} de ${total}`, 200 - 14, 287, { align: "right" });
  doc.text("RailSight © Data Tech — datatechinfo19@gmail.com — +55 (32) 99141-3852", 14, 287);
}

async function drawCover(doc, { logoSrc, title, client, presetName }) {
  // Fundo leve
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, 210, 297, "F");

  // Logo (opcional)
  if (logoSrc) {
    try {
      // Se for URL do mesmo domínio, html2canvas não é necessário — deixamos o jsPDF carregar direto
      // Caso falhe, simplesmente ignora o logo.
      doc.addImage(logoSrc, "PNG", 30, 28, 30, 30);
    } catch { /* no-op */ }
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("RailSight", 30, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.text("Relatório Técnico de Geometria da Via", 30, 92);

  doc.setFontSize(12);
  const today = new Date();
  const dt = today.toLocaleDateString("pt-BR");
  const lines = [
    { k: "Cliente", v: client || "—" },
    { k: "Norma/Preset", v: presetName || "—" },
    { k: "Data", v: dt },
    { k: "Produto", v: "RailSight — Data Tech" },
  ];
  let y = 115;
  doc.setFont("helvetica", "bold");
  doc.text("Metadados", 30, y);
  doc.setFont("helvetica", "normal");
  y += 8;
  lines.forEach(({ k, v }) => {
    doc.text(`${k}:`, 30, y);
    doc.text(String(v), 60, y);
    y += 7;
  });

  // Bloco de destaque
  y += 10;
  doc.setDrawColor(60, 60, 60);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(30, y, 150, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.text(title || "Monitoramento Ferroviário", 36, y + 12);
}

/* =========================
   Captura de gráficos (DOM -> PNG)
========================= */
async function captureElementPng(elementOrSelector, { maxWidthPx = 1000 } = {}) {
  const el =
    typeof elementOrSelector === "string"
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;
  if (!el) throw new Error(`Elemento não encontrado: ${elementOrSelector}`);

  // Força remoção de barras e legendas no print
  const oldOverflow = el.style.overflow;
  el.style.overflow = "visible";

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, maxWidthPx / el.clientWidth || 1),
    useCORS: true,
  });

  el.style.overflow = oldOverflow;
  return canvas.toDataURL("image/png");
}

/* =========================
   Conteúdo técnico (sumário + conclusões)
========================= */
function addTableOfContents(doc, items) {
  header(doc, "RailSight — Data Tech");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Sumário", 14, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 44;
  items.forEach((it, idx) => {
    doc.text(`${idx + 1}. ${it.title}`, 18, y);
    y += 7;
    if (y > 270) {
      doc.addPage();
      header(doc, "RailSight — Data Tech");
      y = 30;
    }
  });
}

function addConclusions(doc, { conclusions = [], summary = {} }) {
  header(doc, "RailSight — Data Tech");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Conclusões e Resumo Executivo", 14, 34);

  // Resumo
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo:", 14, 48);
  doc.setFont("helvetica", "normal");
  let y = 56;

  const blocks = [
    `Campanhas avaliadas: ${summary.campaignCount ?? "—"}`,
    `Canais analisados: ${summary.channels ?? "Curvatura, Crosslevel, Rate, Twist, Warp, Gauge"}`,
    `Pontos acima de ALARME: ${summary.alarmCount ?? "—"}`,
    `Pontos em ATENÇÃO: ${summary.warnCount ?? "—"}`,
  ];
  blocks.forEach((t) => {
    doc.text(`• ${t}`, 18, y);
    y += 7;
  });

  // Conclusões
  if (conclusions.length) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Conclusões:", 14, y);
    doc.setFont("helvetica", "normal");
    y += 8;
    conclusions.forEach((c) => {
      const textWidth = 180;
      const lines = doc.splitTextToSize(`• ${c}`, textWidth);
      lines.forEach((ln) => {
        doc.text(14, y, ln);
        y += 6;
      });
      y += 2;
      if (y > 270) {
        doc.addPage();
        header(doc, "RailSight — Data Tech");
        y = 30;
      }
    });
  }
}

/* =========================
   Público — função principal
========================= */
/**
 * Gera e baixa um PDF.
 * @param {Object} opts
 * @param {string} opts.title - título do relatório/campanha
 * @param {string} opts.client - nome do cliente/ferrovia
 * @param {string} opts.presetName - nome da norma/preset
 * @param {string} [opts.logoSrc] - dataURL/URL do logo
 * @param {Array<{title:string, element:HTMLElement|string}>} opts.charts - gráficos a capturar
 * @param {Array<string>} [opts.conclusions] - bullets de conclusão
 * @param {Object} [opts.summary] - contagens (alarmCount, warnCount, campaignCount, channels)
 */
export async function buildAndSaveReport({
  title = "Relatório RailSight",
  client = "—",
  presetName = "—",
  logoSrc,
  charts = [],
  conclusions = [],
  summary = {},
} = {}) {
  // A4 retrato
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // CAPA
  await drawCover(doc, { logoSrc, title, client, presetName });

  // SUMÁRIO
  if (charts.length) {
    doc.addPage();
    addTableOfContents(doc, charts.map((c) => ({ title: c.title })));
  }

  // GRÁFICOS
  for (let i = 0; i < charts.length; i++) {
    const c = charts[i];
    doc.addPage();
    header(doc, "RailSight — Data Tech");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${i + 1}. ${c.title}`, 14, 28);

    try {
      const dataUrl = await captureElementPng(c.element, { maxWidthPx: 1600 });
      // Área útil aproximada (margens top 32 / bottom 20)
      const maxW = 180; // mm
      const maxH = 200; // mm
      // Mantém proporção 16:9 aproximada
      const w = maxW;
      const h = Math.min(maxH, (maxW * 9) / 16);

      doc.addImage(dataUrl, "PNG", 14, 34, w, h, undefined, "FAST");
    } catch (e) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 0, 0);
      doc.text(`Falha ao capturar gráfico: ${c.title}`, 14, 40);
      doc.setTextColor(20, 20, 20);
    }
  }

  // CONCLUSÕES
  doc.addPage();
  addConclusions(doc, { conclusions, summary });

  // Numeração de páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footer(doc, p, total);
  }

  // Salvar
  const safeClient = (client || "cliente").replace(/[^\w\-]+/g, "_");
  const safeTitle = (title || "relatorio").replace(/[^\w\-]+/g, "_");
  doc.save(`${safeClient}_${safeTitle}.pdf`);
}

/* =========================
   Atalho simples
========================= */
/**
 * Constrói a lista de gráficos automaticamente a partir de seletores.
 * Ex.: buildReportFromSelectors({ charts: [
 *   { title: "Curvatura", selector: "#pane-curv" },
 *   { title: "Crosslevel", selector: "#pane-xlev" },
 * ]})
 */
export async function buildReportFromSelectors({
  title,
  client,
  presetName,
  logoSrc,
  charts = [],
  conclusions = [],
  summary = {},
} = {}) {
  const mapped = charts.map((c) => ({
    title: c.title,
    element: c.selector,
  }));
  return buildAndSaveReport({
    title,
    client,
    presetName,
    logoSrc,
    charts: mapped,
    conclusions,
    summary,
  });
}
