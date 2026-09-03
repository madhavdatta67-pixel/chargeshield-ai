/* ChargeShield AI — chart helpers (thin wrappers around Chart.js) */

const CHART_REGISTRY = {};

function destroyChart(id) {
  if (CHART_REGISTRY[id]) {
    CHART_REGISTRY[id].destroy();
    delete CHART_REGISTRY[id];
  }
}

const CHART_COLORS = {
  amber: "#e8a23d",
  teal: "#2fbf9f",
  red: "#e15554",
  blue: "#5b8def",
  grid: "rgba(232,236,244,0.08)",
  text: "#8592ab",
};

Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
Chart.defaults.color = CHART_COLORS.text;
Chart.defaults.borderColor = CHART_COLORS.grid;

function lineChart(canvasId, labels, datasets) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  CHART_REGISTRY[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        backgroundColor: d.color + "22",
        fill: d.fill !== false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { boxWidth: 10 } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: CHART_COLORS.grid }, beginAtZero: true },
      },
    },
  });
}

function barChart(canvasId, labels, datasets, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  CHART_REGISTRY[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color,
        borderRadius: 3,
        maxBarThickness: 36,
      })),
    },
    options: {
      indexAxis: opts.horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { boxWidth: 10 } } },
      scales: {
        x: { grid: { display: !opts.horizontal ? false : true, color: CHART_COLORS.grid }, beginAtZero: true },
        y: { grid: { display: opts.horizontal ? false : true, color: CHART_COLORS.grid }, beginAtZero: true },
      },
    },
  });
}

function doughnutChart(canvasId, labels, data, colors) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  CHART_REGISTRY[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 14 } } },
    },
  });
}

function scatterROC(canvasId, points, label) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  CHART_REGISTRY[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label,
          data: points,
          borderColor: CHART_COLORS.blue,
          backgroundColor: "transparent",
          showLine: true,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Random",
          data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          borderColor: CHART_COLORS.grid,
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", min: 0, max: 1, title: { display: true, text: "False Positive Rate" }, grid: { color: CHART_COLORS.grid } },
        y: { type: "linear", min: 0, max: 1, title: { display: true, text: "True Positive Rate" }, grid: { color: CHART_COLORS.grid } },
      },
      plugins: { legend: { labels: { boxWidth: 10 } } },
    },
  });
}

function rocCurvePoints(yTrue, scores) {
  const thresholds = Array.from(new Set(scores)).sort((a, b) => b - a);
  thresholds.push(1.01);
  const pts = [];
  for (const t of thresholds) {
    const pred = scores.map((s) => (s >= t ? 1 : 0));
    const cm = confusionMatrix(yTrue, pred);
    const tpr = cm.tp + cm.fn === 0 ? 0 : cm.tp / (cm.tp + cm.fn);
    const fpr = cm.fp + cm.tn === 0 ? 0 : cm.fp / (cm.fp + cm.tn);
    pts.push({ x: fpr, y: tpr });
  }
  pts.sort((a, b) => a.x - b.x);
  return pts;
}
