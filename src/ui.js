// ui.js — rendering helpers for Chart.js
let _missingChart, _distChart;

export function renderMissingnessChart(ctxId, labels, values) {
  const ctx = document.getElementById(ctxId);
  if (!ctx) return;
  if (_missingChart) _missingChart.destroy();
  _missingChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Missing values', data: values }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: false } },
      scales: { x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } }, y: { beginAtZero: true } }
    }
  });
}

export function renderDistributionChart(ctxId, labels, values) {
  const ctx = document.getElementById(ctxId);
  if (!ctx) return;
  if (_distChart) _distChart.destroy();
  _distChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data: values }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: false } },
      scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 20 } }, y: { beginAtZero: true } }
    }
  });
}
