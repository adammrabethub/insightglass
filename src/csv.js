// Reads CSV/TSV via PapaParse (streaming), Excel via SheetJS, JSON array.
// Returns array of row objects. Provides a simple profiler.

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
    const min = numeric ? Math.min(...nums) : null;
    const max = numeric ? Math.max(...nums) : null;
    const mean = numeric ? nums.reduce((a,b)=>a+b,0) / nums.length : null;
    stats[col] = {
      nonNull: vals.length,
      missing: n - vals.length,
      unique: new Set(vals.map(v => String(v))).size,
      numeric, min, max, mean
    };
  }
  return { rows: n, columns, stats, preview: rows.slice(0, 5) };
}
