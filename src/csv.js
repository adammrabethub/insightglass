// Reads CSV/TSV via PapaParse, Excel via SheetJS, JSON array.
// Profiling now includes std dev; adds histogram + anomaly summary utilities.

export async function loadFile(file, { sample = true, sampleRows = 50000 } = {}) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (['csv','tsv','txt'].includes(ext)) {
    return await loadCSV(file, { sample, sampleRows, delimiter: ext === 'tsv' ? '\t' : ',' });
  } else if (['xlsx','xls'].includes(ext)) {
    return await loadXLSX(file, { sample, sampleRows });
  } else if (ext === 'json') {
    const text = await file.text();
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : [];
  } else {
    throw new Error('Unsupported file type.');
  }
}

async function loadCSV(file, { sample, sampleRows, delimiter = ',' }) {
  return new Promise((resolve, reject) => {
    const out = [];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      worker: true,
      step: (results, parser) => {
        const row = results.data;
        out.push(row);
        if (sample && out.length >= sampleRows) parser.abort();
      },
      complete: () => resolve(out),
      error: (err) => reject(err)
    });
  });
}

async function loadXLSX(file, { sample, sampleRows }) {
  const data = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return sample ? rows.slice(0, sampleRows) : rows;
}

export function profileRows(rows) {
  if (!rows.length) return { rows: 0, columns: [], stats: {}, preview: [] };
  const n = rows.length;
  const columns = Object.keys(rows[0]);
  const stats = {};
  for (const col of columns) {
    const vals = rows.map(r => r[col]).filter(v => v !== '' && v != null);
    const nums = [];
    for (const v of vals) {
      const num = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(num) && Number.isFinite(num)) nums.push(num);
    }
    const numeric = nums.length >= 0.7 * vals.length && nums.length > 0;
    let min = null, max = null, mean = null, std = null;
    if (numeric) {
      min = Math.min(...nums);
      max = Math.max(...nums);
      mean = nums.reduce((a,b)=>a+b,0) / nums.length;
      const variance = nums.reduce((a,b)=>a + (b-mean)*(b-mean), 0) / Math.max(1, (nums.length-1));
      std = Math.sqrt(variance);
    }
    stats[col] = {
      nonNull: vals.length,
      missing: n - vals.length,
      unique: new Set(vals.map(v => String(v))).size,
      numeric, min, max, mean, std
    };
  }
  return { rows: n, columns, stats, preview: rows.slice(0, 5) };
}

// Simple histogram for one numeric column
export function histogramForColumn(rows, col, bins = 20) {
  const nums = rows.map(r => Number(r[col])).filter(v => Number.isFinite(v));
  if (!nums.length) return { labels: [], counts: [] };
  const min = Math.min(...nums), max = Math.max(...nums);
  const width = (max - min) / (bins || 1) || 1;
  const counts = new Array(bins).fill(0);
  for (const v of nums) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const labels = counts.map((_, i) => {
    const a = min + i*width;
    const b = i === bins-1 ? max : (a + width);
    return `${round(a)}–${round(b)}`;
  });
  return { labels, counts };

  function round(x) {
    if (Math.abs(x) >= 1000) return Math.round(x);
    return Math.round(x * 100) / 100;
  }
}

// Basic anomaly summary by z-score (>3σ)
export function anomalySummary(rows, profile) {
  const out = [];
  for (const [col, s] of Object.entries(profile.stats)) {
    if (!s.numeric || s.std == null || s.std === 0) continue;
    const mean = s.mean, std = s.std;
    let count = 0;
    for (const r of rows) {
      const v = Number(r[col]);
      if (!Number.isFinite(v)) continue;
      const z = (v - mean) / std;
      if (Math.abs(z) > 3) count++;
    }
    if (count > 0) out.push({ column: col, outliers: count });
  }
  // sort descending
  out.sort((a,b)=>b.outliers - a.outliers);
  return out;
}
