import { testPromptAPI, getInsightsFromStats, getSummaryFromText } from './ai.js';
import { loadFile, profileRows, histogramForColumn, anomalySummary } from './csv.js';
import { renderMissingnessChart, renderDistributionChart } from './ui.js';

const fileInput = document.getElementById('file');
const sampleChk = document.getElementById('sampleChk');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const profileEl = document.getElementById('profile');
const insightsEl = document.getElementById('insights');
const summaryEl = document.getElementById('summary');

document.getElementById('testBtn').addEventListener('click', async () => {
  statusEl.textContent = 'Running AI test…';
  try {
    const res = await testPromptAPI();
    statusEl.textContent = `AI says: ${res}`;
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
});

let loadedRows = [];

fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  statusEl.textContent = `Loading ${f.name}…`;
  try {
    loadedRows = await loadFile(f, { sample: sampleChk.checked, sampleRows: 50000 });
    statusEl.textContent = `Loaded ${loadedRows.length.toLocaleString()} rows from ${f.name}`;
    analyzeBtn.disabled = loadedRows.length === 0;
  } catch (e) {
    console.error(e);
    statusEl.textContent = `Error: ${e.message}`;
  }
});

analyzeBtn.addEventListener('click', async () => {
  if (!loadedRows.length) return;
  try {
    statusEl.textContent = 'Profiling…';
    const prof = profileRows(loadedRows);
    profileEl.textContent = JSON.stringify(prof, null, 2);

    // Charts: missingness
    const missLabels = Object.keys(prof.stats);
    const missValues = missLabels.map(c => prof.stats[c].missing || 0);
    renderMissingnessChart('missingChart', missLabels, missValues);

    // Distribution chart: pick top numeric column (most unique)
    const numericCols = missLabels.filter(c => prof.stats[c].numeric);
    if (numericCols.length) {
      const top = numericCols.sort((a,b)=> (prof.stats[b].unique||0) - (prof.stats[a].unique||0))[0];
      const { labels, counts } = histogramForColumn(loadedRows, top, 20);
      renderDistributionChart('distChart', labels, counts);
    }

    // Anomaly summary
    const anomalies = anomalySummary(loadedRows, prof);
    if (anomalies.length) {
      const txt = anomalies.slice(0,5).map(a => `• ${a.column}: ${a.outliers} outliers (>3σ)`).join('\\n');
      insightsEl.textContent = `Anomaly summary (pre-AI):\\n${txt}\\n\\n`;
    } else {
      insightsEl.textContent = 'Anomaly summary (pre-AI): none detected\\n\\n';
    }

    statusEl.textContent = 'Generating insights (Prompt API)…';
    const insights = await getInsightsFromStats(prof);
    insightsEl.textContent += insights;

    statusEl.textContent = 'Summarizing (Summarizer API)…';
    const summary = await getSummaryFromText(
      `Dataset profile:\n${JSON.stringify(prof)}\n\nInsights:\n${insights}`
    );
    summaryEl.textContent = summary;

    statusEl.textContent = 'Done.';
  } catch (e) {
    console.error(e);
    statusEl.textContent = `Error: ${e.message}`;
  }
});
