import { testPromptAPI, getInsightsFromStats, getSummaryFromText } from './ai.js';
import { loadFile, profileRows } from './csv.js';

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

    statusEl.textContent = 'Generating insights (Prompt API)…';
    const insights = await getInsightsFromStats(prof);
    insightsEl.textContent = insights;

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
