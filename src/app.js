import {
  testPromptAPI,
  getInsightsFromStats,
  getSummaryFromText,
  proofreadText,
  translateText
} from './ai.js';

import {
  loadFile,
  profileRows,
  histogramForColumn,
  anomalySummary
} from './csv.js';

import {
  renderMissingnessChart,
  renderDistributionChart
} from './ui.js';

const fileInput   = document.getElementById('file');
const sampleChk   = document.getElementById('sampleChk');
const analyzeBtn  = document.getElementById('analyzeBtn');
const statusEl    = document.getElementById('status');
const profileEl   = document.getElementById('profile');
const insightsEl  = document.getElementById('insights');
const summaryEl   = document.getElementById('summary');

const testBtn      = document.getElementById('testBtn');
const proofBtn     = document.getElementById('proofBtn');
const translateBtn = document.getElementById('translateBtn');
const langSelect   = document.getElementById('langSelect');

testBtn?.addEventListener('click', async () => {
  statusEl.textContent = 'Running AI test…';
  try {
    const res = await testPromptAPI();
    statusEl.textContent = `AI says: ${res}`;
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
});

let loadedRows = [];

fileInput?.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  statusEl.textContent = `Loading ${f.name}…`;
  try {
    loadedRows = await loadFile(f, { sample: sampleChk?.checked ?? true, sampleRows: 50000 });
    statusEl.textContent = `Loaded ${loadedRows.length.toLocaleString()} rows from ${f.name}`;
    analyzeBtn.disabled = loadedRows.length === 0;
  } catch (e) {
    console.error(e);
    statusEl.textContent = `Error: ${e.message}`;
  }
});

analyzeBtn?.addEventListener('click', async () => {
  if (!loadedRows.length) return;
  try {
    statusEl.textContent = 'Profiling…';
    const prof = profileRows(loadedRows);
    profileEl.textContent = JSON.stringify(prof, null, 2);

    // Charts: missingness
    const cols = Object.keys(prof.stats);
    const missValues = cols.map(c => prof.stats[c].missing || 0);
    renderMissingnessChart('missingChart', cols, missValues);

    // Distribution: pick top numeric column (by #unique)
    const numericCols = cols.filter(c => prof.stats[c].numeric);
    if (numericCols.length) {
      const top = numericCols.sort((a,b)=> (prof.stats[b].unique||0) - (prof.stats[a].unique||0))[0];
      const { labels, counts } = histogramForColumn(loadedRows, top, 20);
      renderDistributionChart('distChart', labels, counts);
    }

    // Pre-AI anomaly summary
    const anomalies = anomalySummary(loadedRows, prof);
    if (anomalies.length) {
      const txt = anomalies.slice(0,5).map(a => `• ${a.column}: ${a.outliers} outliers (>3σ)`).join('\n');
      insightsEl.textContent = `Anomaly summary (pre-AI):\n${txt}\n\n`;
    } else {
      insightsEl.textContent = 'Anomaly summary (pre-AI): none detected\n\n';
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

// ---- Proofread button ----
proofBtn?.addEventListener('click', async () => {
  try {
    proofBtn.disabled = true;
    statusEl.textContent = 'Proofreading…';
    const text = summaryEl.textContent || '';
    const corrected = await proofreadText(text);
    summaryEl.textContent = corrected;
    statusEl.textContent = 'Proofread done.';
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  } finally {
    proofBtn.disabled = false;
  }
});

// ---- Translate button ----
translateBtn?.addEventListener('click', async () => {
  try {
    translateBtn.disabled = true;
    const tgt = langSelect?.value || 'fr';
    statusEl.textContent = `Translating to ${tgt}…`;
    const text = summaryEl.textContent || '';
    const translated = await translateText(text, tgt);
    summaryEl.textContent = translated;

    // Optional RTL handling for Arabic
    if (tgt === 'ar') {
      summaryEl.setAttribute('dir', 'rtl');
    } else {
      summaryEl.removeAttribute('dir');
    }

    statusEl.textContent = 'Translation done.';
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  } finally {
    translateBtn.disabled = false;
  }
});
