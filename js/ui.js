/* ChargeShield AI — UI rendering + hash router */

const NAV_ITEMS = [
  { route: "overview", label: "Overview", icon: iconShield() },
  { route: "cases", label: "Chargeback Cases", icon: iconDoc() },
  { route: "fraud", label: "Fraud Detector", icon: iconBolt() },
  { route: "returns", label: "Return Risk", icon: iconArrowU() },
  { route: "timeline", label: "Risk Timeline", icon: iconClock() },
  { route: "models", label: "Model Metrics & Cost", icon: iconChart() },
  { route: "demo", label: "Demo Scenarios", icon: iconPlay() },
];

function icon(paths, vb = "0 0 24 24") {
  return `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
function iconShield() { return icon('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>'); }
function iconDoc() { return icon('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>'); }
function iconBolt() { return icon('<path d="M12 2 4 14h6l-1 8 9-13h-6l1-7z"/>'); }
function iconArrowU() { return icon('<path d="M4 14a8 8 0 1 1 8 8"/><path d="M4 8v6h6"/>'); }
function iconClock() { return icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'); }
function iconChart() { return icon('<path d="M4 20V10M12 20V4M20 20v-7"/>'); }
function iconPlay() { return icon('<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>'); }

function fmtINR(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function fmtPct(n) {
  return (n * 100).toFixed(1) + "%";
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------------------------- shell / layout --------------------------- */

function renderShell() {
  const el = document.getElementById("root");
  el.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">${iconShield()}</span>
          <div class="brand-text">
            <div class="brand-name">ChargeShield<span class="brand-ai">AI</span></div>
            <div class="brand-tag">Merchant risk intelligence</div>
          </div>
        </div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-footer">
          <div class="synthetic-badge">Synthetic demo data</div>
          <div class="merchant-name">Aarambh Home &amp; Living</div>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>
  `;
  const nav = document.getElementById("nav");
  nav.innerHTML = NAV_ITEMS.map(
    (i) => `<a href="#/${i.route}" class="nav-item" data-route="${i.route}"><span class="nav-icon">${i.icon}</span>${i.label}</a>`
  ).join("");
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function router() {
  const hash = location.hash.replace(/^#\//, "") || "overview";
  const [route, param] = hash.split("/");
  setActiveNav(route);
  const main = document.getElementById("main");
  main.innerHTML = "";
  main.scrollTop = 0;

  switch (route) {
    case "overview": return renderOverview(main);
    case "cases": return param ? renderCaseDetail(main, param) : renderCasesList(main);
    case "fraud": return renderFraud(main);
    case "returns": return renderReturns(main);
    case "timeline": return renderTimeline(main, param);
    case "models": return renderModels(main);
    case "demo": return renderDemo(main);
    default: return renderOverview(main);
  }
}

/* ------------------------------ overview -------------------------------- */

function computeOverviewMetrics() {
  const ds = STATE.ds;
  const totalOrdersValue = ds.orders.reduce((s, o) => s + o.orderAmount, 0);
  const cbAmount = ds.chargebacks.reduce((s, c) => s + c.amount, 0);
  const highRiskTxns = STATE.fraudPipeline.testScoresLR.filter((s) => s >= STATE.fraudThreshold).length;
  const highRiskReturns = STATE.returnPipeline.testScoresLR.filter((s) => s >= STATE.returnThreshold).length;
  const evidencePackages = ds.chargebacks.length;
  const protectedRevenue = totalOrdersValue - cbAmount;

  return {
    protectedRevenue,
    potentialLoss: cbAmount,
    chargebackCases: ds.chargebacks.length,
    highRiskTxns,
    highRiskReturns,
    evidencePackages,
  };
}

function renderOverview(main) {
  const m = computeOverviewMetrics();
  const ds = STATE.ds;

  main.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Overview</h1>
        <p class="subtle">Detect risk early. Preserve evidence. Defend revenue.</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" id="export-report-btn">Export Audit Report</button>
        <a href="#/demo" class="btn btn-primary">Run Demo Scenarios</a>
      </div>
    </header>

    <section class="kpi-grid">
      ${kpiCard("Protected Revenue", fmtINR(m.protectedRevenue), "teal", "Orders fulfilled without an active dispute")}
      ${kpiCard("Potential Loss Detected", fmtINR(m.potentialLoss), "amber", "Total amount across open chargeback cases")}
      ${kpiCard("Chargeback Cases", m.chargebackCases, "blue", "Currently tracked in case management")}
      ${kpiCard("High-Risk Transactions", m.highRiskTxns, "red", "Flagged on held-out test data at current threshold")}
      ${kpiCard("High-Risk Returns", m.highRiskReturns, "amber", "Flagged on held-out test data at current threshold")}
      ${kpiCard("Evidence Packages Generated", m.evidencePackages, "blue", "One per chargeback case")}
    </section>

    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Fraud Signal Trend (90 days, synthetic)</h3></div>
        <div class="chart-box"><canvas id="chart-fraud-trend"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Return Risk Distribution</h3></div>
        <div class="chart-box"><canvas id="chart-return-dist"></canvas></div>
      </div>
    </section>

    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Chargeback Case Pipeline</h3></div>
        <div class="chart-box"><canvas id="chart-cb-pipeline"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Model Precision &amp; Recall (held-out test set)</h3></div>
        <div class="chart-box"><canvas id="chart-model-pr"></canvas></div>
      </div>
    </section>
  `;

  // Fraud trend: bucket synthetic txn fraud probability by week
  const byWeek = {};
  ds.transactions.forEach((t) => {
    const wk = Math.floor((Date.now() - new Date(t.timestamp)) / (7 * 86400000));
    byWeek[wk] = byWeek[wk] || { count: 0, flagged: 0 };
    byWeek[wk].count++;
    if (t.label_fraud) byWeek[wk].flagged++;
  });
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => b - a).slice(0, 13).reverse();
  lineChart(
    "chart-fraud-trend",
    weeks.map((w) => `W-${w}`),
    [{ label: "Flagged rate", data: weeks.map((w) => +(100 * byWeek[w].flagged / byWeek[w].count).toFixed(1)), color: CHART_COLORS.red }]
  );

  const buckets = { Low: 0, Medium: 0, High: 0 };
  STATE.returnPipeline.testScoresLR.forEach((s) => {
    if (s < 0.3) buckets.Low++; else if (s < 0.6) buckets.Medium++; else buckets.High++;
  });
  doughnutChart("chart-return-dist", Object.keys(buckets), Object.values(buckets), [CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.red]);

  const statusCounts = {};
  ds.chargebacks.forEach((c) => {
    const st = STATE.caseStore[c.id].status;
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });
  barChart("chart-cb-pipeline", Object.keys(statusCounts), [{ label: "Cases", data: Object.values(statusCounts), color: CHART_COLORS.blue }], { horizontal: true });

  barChart(
    "chart-model-pr",
    ["Fraud (LogReg)", "Fraud (Ensemble)", "Return (LogReg)", "Return (Ensemble)"],
    [
      { label: "Precision", data: [
        STATE.fraudPipeline.logreg.testEval.precision,
        STATE.fraudPipeline.forest.testEval.precision,
        STATE.returnPipeline.logreg.testEval.precision,
        STATE.returnPipeline.forest.testEval.precision,
      ].map((v) => +(v * 100).toFixed(1)), color: CHART_COLORS.teal },
      { label: "Recall", data: [
        STATE.fraudPipeline.logreg.testEval.recall,
        STATE.fraudPipeline.forest.testEval.recall,
        STATE.returnPipeline.logreg.testEval.recall,
        STATE.returnPipeline.forest.testEval.recall,
      ].map((v) => +(v * 100).toFixed(1)), color: CHART_COLORS.blue },
    ]
  );

  document.getElementById("export-report-btn").addEventListener("click", () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      merchant: "Aarambh Home & Living",
      metrics: m,
      chargebacks: ds.chargebacks.map((c) => {
        const evalR = STATE.evalCache[c.id];
        return {
          id: c.id,
          customerId: c.customerId,
          claim: c.claimLabel,
          amount: c.amount,
          priority: c.priority,
          status: STATE.caseStore[c.id].status,
          defenseStrength: evalR.score,
          recommendation: evalR.recommendation,
        };
      }),
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chargeshield_risk_audit_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function kpiCard(label, value, tone, sub) {
  return `
    <div class="kpi-card tone-${tone}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>
  `;
}

/* ------------------------------ cases list ------------------------------- */

function statusPillClass(status) {
  return "pill pill-" + status.toLowerCase().replace(/\s+/g, "-");
}

function renderCasesList(main) {
  const ds = STATE.ds;
  main.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Chargeback Cases</h1>
        <p class="subtle" id="cases-count-subtle">Showing ${ds.chargebacks.length} cases · evidence auto-collected from payment, order, delivery, and support systems</p>
      </div>
    </header>

    <section class="panel filter-bar">
      <div class="filter-inputs">
        <input type="text" id="case-search-input" class="text-input" placeholder="Search case ID, customer, claim..." />
        
        <select id="case-priority-filter" class="select">
          <option value="">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>

        <select id="case-status-filter" class="select">
          <option value="">All Statuses</option>
          ${CASE_STAGES.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>

        <select id="case-score-filter" class="select">
          <option value="">All Defense Scores</option>
          <option value="strong">Strong (≥75%)</option>
          <option value="moderate">Moderate (55-74%)</option>
          <option value="review">Review Required (32-54%)</option>
          <option value="weak">Weak (<32%)</option>
        </select>
      </div>
    </section>

    <section class="panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>Case</th><th>Claim</th><th>Amount</th><th>Priority</th><th>Filed</th>
            <th>Defense Strength</th><th>Recommendation</th><th>Status</th>
          </tr>
        </thead>
        <tbody id="cases-table-tbody"></tbody>
      </table>
    </section>
  `;

  function updateCasesList() {
    const query = (document.getElementById("case-search-input")?.value || "").toLowerCase().trim();
    const priority = document.getElementById("case-priority-filter")?.value || "";
    const status = document.getElementById("case-status-filter")?.value || "";
    const scoreCategory = document.getElementById("case-score-filter")?.value || "";

    const filtered = ds.chargebacks.filter((c) => {
      const evalR = STATE.evalCache[c.id];
      const caseStatus = STATE.caseStore[c.id].status;

      if (query) {
        const matchesQuery =
          c.id.toLowerCase().includes(query) ||
          c.customerId.toLowerCase().includes(query) ||
          c.claimLabel.toLowerCase().includes(query) ||
          c.amount.toString().includes(query);
        if (!matchesQuery) return false;
      }
      if (priority && c.priority !== priority) return false;
      if (status && caseStatus !== status) return false;
      if (scoreCategory && evalR.recColor !== scoreCategory) return false;

      return true;
    });

    const subtleEl = document.getElementById("cases-count-subtle");
    if (subtleEl) {
      subtleEl.textContent = `Showing ${filtered.length} of ${ds.chargebacks.length} cases · evidence auto-collected from payment, order, delivery, and support systems`;
    }

    const tbody = document.getElementById("cases-table-tbody");
    if (tbody) {
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-faint);">No cases match the selected filters.</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((c) => {
          const evalR = STATE.evalCache[c.id];
          return `
            <tr class="row-link" data-href="#/cases/${c.id}">
              <td class="mono">${c.id}</td>
              <td>${c.claimLabel}</td>
              <td class="mono">${fmtINR(c.amount)}</td>
              <td><span class="pill pill-priority-${c.priority.toLowerCase()}">${c.priority}</span></td>
              <td>${fmtDate(c.filedTimestamp)}</td>
              <td>
                <div class="mini-bar"><div class="mini-bar-fill tone-${evalR.recColor}" style="width:${evalR.score}%"></div></div>
                <span class="mono small">${evalR.score}%</span>
              </td>
              <td><span class="pill pill-${evalR.recColor}">${evalR.recommendation}</span></td>
              <td><span class="${statusPillClass(STATE.caseStore[c.id].status)}">${STATE.caseStore[c.id].status}</span></td>
            </tr>`;
        }).join("");

        tbody.querySelectorAll(".row-link").forEach((r) => {
          r.addEventListener("click", () => { location.hash = r.dataset.href; });
        });
      }
    }
  }

  document.getElementById("case-search-input")?.addEventListener("input", updateCasesList);
  document.getElementById("case-priority-filter")?.addEventListener("change", updateCasesList);
  document.getElementById("case-status-filter")?.addEventListener("change", updateCasesList);
  document.getElementById("case-score-filter")?.addEventListener("change", updateCasesList);

  updateCasesList();
}

/* ------------------------------ case detail ------------------------------ */

const CASE_STAGES = ["NEW", "EVIDENCE COLLECTION", "VERIFICATION", "AI ANALYSIS", "MANUAL REVIEW", "READY TO RESPOND", "SUBMITTED", "RESOLVED"];

function renderCaseDetail(main, caseId) {
  const ds = STATE.ds;
  const cbCase = ds.chargebacks.find((c) => c.id === caseId);
  if (!cbCase) { main.innerHTML = `<p>Case not found.</p>`; return; }
  const evalR = STATE.evalCache[caseId];
  const caseState = STATE.caseStore[caseId];
  const stageIdx = CASE_STAGES.indexOf(caseState.status);

  main.innerHTML = `
    <header class="page-head">
      <div>
        <a href="#/cases" class="breadcrumb">← All cases</a>
        <h1>Chargeback Case ${cbCase.id}</h1>
        <p class="subtle">${cbCase.claimLabel} · Filed ${fmtDate(cbCase.filedTimestamp)} · Customer ${cbCase.customerId}</p>
      </div>
      <div class="head-actions">
        <span class="pill pill-priority-${cbCase.priority.toLowerCase()}">${cbCase.priority} PRIORITY</span>
        <span class="mono amount-tag">${fmtINR(cbCase.amount)}</span>
      </div>
    </header>

    <section class="panel stage-panel">
      <div class="stage-track">
        ${CASE_STAGES.map((s, i) => `<div class="stage-step ${i <= stageIdx ? "done" : ""} ${i === stageIdx ? "current" : ""}"><span class="stage-dot"></span>${s}</div>`).join("")}
      </div>
      <div class="stage-actions">
        <button class="btn btn-ghost" id="advance-btn" ${stageIdx >= CASE_STAGES.length - 1 ? "disabled" : ""}>Advance Stage →</button>
        <select id="reviewer-select" class="select">
          <option value="">Assign reviewer…</option>
          <option value="P. Sharma" ${caseState.reviewer === "P. Sharma" ? "selected" : ""}>P. Sharma</option>
          <option value="A. Khan" ${caseState.reviewer === "A. Khan" ? "selected" : ""}>A. Khan</option>
          <option value="R. Iyer" ${caseState.reviewer === "R. Iyer" ? "selected" : ""}>R. Iyer</option>
        </select>
      </div>
    </section>

    <section class="case-grid">
      <div class="panel score-panel">
        <div class="panel-head"><h3>Chargeback Defense Strength</h3></div>
        <div class="score-display tone-${evalR.recColor}">
          <div class="score-number">${evalR.score}%</div>
          <div class="score-bar-track"><div class="score-bar-fill" style="width:${evalR.score}%"></div></div>
        </div>
        <div class="rec-badge pill pill-${evalR.recColor}">${evalR.recommendation}</div>
        <p class="confidence-note">Confidence: ${evalR.score > 80 || evalR.score < 20 ? "High" : "Moderate"} — rule-based evidence scoring, not a certainty claim.</p>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Evidence</h3></div>
        <ul class="evidence-list">
          ${evalR.checks.map((c) => `
            <li class="evidence-item status-${c.status}">
              <span class="evidence-icon">${c.status === "pass" ? "✓" : c.status === "warn" ? "⚠" : "✕"}</span>
              <div><div class="evidence-label">${c.label}</div><div class="evidence-note">${c.note}</div></div>
            </li>`).join("")}
        </ul>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>AI Analysis — Why this score</h3></div>
        <ul class="factor-list">
          ${evalR.factors.map((f) => `
            <li class="factor-item">
              <span class="factor-points ${f.points >= 0 ? "pos" : "neg"}">${f.points >= 0 ? "+" : ""}${f.points}</span>
              <span>${f.label}</span>
            </li>`).join("")}
        </ul>
      </div>

      <div class="panel case-timeline-panel">
        <div class="panel-head"><h3>Case Timeline</h3></div>
        ${renderMiniTimeline(cbCase, evalR.evidence)}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Draft Evidence Response</h3>
        <div class="panel-head-actions">
          <button class="btn btn-primary" id="generate-btn">Generate Response</button>
          <button class="btn btn-ghost" id="copy-btn" disabled>Copy</button>
          <button class="btn btn-ghost" id="download-btn" disabled>Download .txt</button>
        </div>
      </div>
      <p class="fine-print">AI-drafted from verified evidence only. Missing evidence is explicitly disclosed, never fabricated. Fully editable before submission — human review required before sending.</p>
      <textarea id="draft-response" class="draft-textarea" rows="18" placeholder="Click “Generate Response” to build a draft from verified evidence…" readonly></textarea>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Audit Log</h3></div>
      <ul class="audit-list" id="audit-list">
        ${caseState.audit.map((a) => `<li><span class="mono small">${fmtDateTime(a.ts)}</span> — ${a.note}</li>`).join("")}
      </ul>
    </section>
  `;

  document.getElementById("advance-btn").addEventListener("click", () => {
    const next = CASE_STAGES[Math.min(stageIdx + 1, CASE_STAGES.length - 1)];
    caseState.status = next;
    caseState.audit.push({ ts: new Date().toISOString(), note: `Status advanced to ${next}` });
    renderCaseDetail(main, caseId);
  });
  document.getElementById("reviewer-select").addEventListener("change", (e) => {
    caseState.reviewer = e.target.value;
    caseState.audit.push({ ts: new Date().toISOString(), note: `Assigned reviewer: ${e.target.value || "unassigned"}` });
    renderCaseDetail(main, caseId);
  });
  document.getElementById("generate-btn").addEventListener("click", () => {
    const draft = generateDraftResponse(cbCase, evalR);
    const ta = document.getElementById("draft-response");
    ta.value = draft;
    ta.removeAttribute("readonly");
    document.getElementById("copy-btn").disabled = false;
    document.getElementById("download-btn").disabled = false;
    caseState.audit.push({ ts: new Date().toISOString(), note: "AI evidence response draft generated" });
    document.getElementById("audit-list").innerHTML = caseState.audit.map((a) => `<li><span class="mono small">${fmtDateTime(a.ts)}</span> — ${a.note}</li>`).join("");
  });
  document.getElementById("copy-btn").addEventListener("click", () => {
    const ta = document.getElementById("draft-response");
    ta.select();
    document.execCommand("copy");
  });
  document.getElementById("download-btn").addEventListener("click", () => {
    const content = document.getElementById("draft-response").value;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispute_response_${cbCase.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderMiniTimeline(cbCase, ev) {
  const events = [];
  if (ev.txn) events.push({ label: "Payment Authorized", ts: ev.txn.timestamp });
  if (ev.order) events.push({ label: "Order Created", ts: ev.order.orderTimestamp });
  if (ev.shipment && ev.shipment.shipped) events.push({ label: "Product Shipped", ts: ev.shipment.shippedTimestamp });
  if (ev.shipment && ev.shipment.delivered) events.push({ label: "Delivered", ts: ev.shipment.deliveredTimestamp });
  ev.tickets.forEach((t) => events.push({ label: `Support: ${t.type.replace("_", " ")}`, ts: t.timestamp }));
  events.push({ label: "Chargeback Filed", ts: cbCase.filedTimestamp, flag: true });
  events.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  return `<ol class="mini-timeline">
    ${events.map((e) => `<li class="${e.flag ? "flagged" : ""}"><span class="mono small">${fmtDate(e.ts)}</span> ${e.label}</li>`).join("")}
  </ol>`;
}

/* -------------------------------- fraud ---------------------------------- */

function renderFraud(main) {
  const p = STATE.fraudPipeline;
  const cm = p.logreg.testEval.cm;
  main.innerHTML = `
    <header class="page-head">
      <div><h1>Fraud Risk Detector</h1><p class="subtle">Transaction-level risk scoring · defensive only — flags for human review, never auto-blocks</p></div>
    </header>

    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Live Risk Threshold</h3></div>
        <div class="threshold-row">
          <input type="range" min="0.05" max="0.95" step="0.01" value="${STATE.fraudThreshold}" id="fraud-threshold-slider" class="slider">
          <span class="mono" id="fraud-threshold-value">${STATE.fraudThreshold.toFixed(2)}</span>
        </div>
        <div id="fraud-threshold-stats" class="threshold-stats"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Confusion Matrix (held-out test set)</h3></div>
        <div id="fraud-cm"></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Highest-Risk Transactions (test set)</h3></div>
      <table class="data-table">
        <thead><tr><th>Transaction</th><th>Customer</th><th>Amount</th><th>Fraud Risk</th><th>Why flagged</th><th>Action</th></tr></thead>
        <tbody id="fraud-table-body"></tbody>
      </table>
    </section>
  `;

  const slider = document.getElementById("fraud-threshold-slider");
  slider.addEventListener("input", () => {
    STATE.fraudThreshold = parseFloat(slider.value);
    document.getElementById("fraud-threshold-value").textContent = STATE.fraudThreshold.toFixed(2);
    updateFraudView();
  });
  updateFraudView();
}

function updateFraudView() {
  const p = STATE.fraudPipeline;
  const t = STATE.fraudThreshold;
  const scores = p.testScoresLR;
  const yTrue = p.testYTrue;
  const pred = scores.map((s) => (s >= t ? 1 : 0));
  const cm = confusionMatrix(yTrue, pred);
  const m = metricsFromCM(cm);

  const statsEl = document.getElementById("fraud-threshold-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat"><span>Precision</span><strong>${fmtPct(m.precision)}</strong></div>
      <div class="stat"><span>Recall</span><strong>${fmtPct(m.recall)}</strong></div>
      <div class="stat"><span>F1</span><strong>${fmtPct(m.f1)}</strong></div>
      <div class="stat"><span>Flagged</span><strong>${pred.reduce((a, b) => a + b, 0)} / ${pred.length}</strong></div>
    `;
  }
  const cmEl = document.getElementById("fraud-cm");
  if (cmEl) cmEl.innerHTML = confusionMatrixHTML(cm);

  const refs = STATE.fraudRefs;
  const rows = refs
    .map((r, i) => ({ r, score: scores[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const custById = STATE.custById;
  const tbody = document.getElementById("fraud-table-body");
  if (tbody) {
    tbody.innerHTML = rows.map(({ r, score }) => {
      const cust = custById[r.customerId];
      const reasons = [];
      if (r.attemptsInWindow >= 3) reasons.push(`${r.attemptsInWindow} payment attempts in a short window`);
      if (r.amount > cust.avgOrderValue * 3) reasons.push(`amount is ${(r.amount / cust.avgOrderValue).toFixed(1)}× customer average`);
      if (cust.accountAgeDays < 30) reasons.push("new account");
      if (cust.previousFailedPayments > 0) reasons.push(`${cust.previousFailedPayments} previous failed payments`);
      if (!reasons.length) reasons.push("elevated combination of risk factors");
      return `<tr>
        <td class="mono">${r.id}</td>
        <td class="mono">${r.customerId}</td>
        <td class="mono">${fmtINR(r.amount)}</td>
        <td><span class="risk-chip ${score >= t ? "high" : "low"}">${fmtPct(score)}</span></td>
        <td class="small">${reasons.join("; ")}</td>
        <td><span class="pill ${score >= t ? "pill-review" : "pill-strong"}">${score >= t ? "Manual verification recommended" : "No action needed"}</span></td>
      </tr>`;
    }).join("");
  }
}

function confusionMatrixHTML(cm) {
  return `
    <div class="cm-grid">
      <div class="cm-cell cm-label"></div>
      <div class="cm-cell cm-label">Predicted: Risky</div>
      <div class="cm-cell cm-label">Predicted: Legit</div>
      <div class="cm-cell cm-label">Actual: Risky</div>
      <div class="cm-cell cm-tp">${cm.tp}<span>True Positive</span></div>
      <div class="cm-cell cm-fn">${cm.fn}<span>False Negative</span></div>
      <div class="cm-cell cm-label">Actual: Legit</div>
      <div class="cm-cell cm-fp">${cm.fp}<span>False Positive</span></div>
      <div class="cm-cell cm-tn">${cm.tn}<span>True Negative</span></div>
    </div>
  `;
}

/* -------------------------------- returns --------------------------------- */

function renderReturns(main) {
  const p = STATE.returnPipeline;
  main.innerHTML = `
    <header class="page-head">
      <div><h1>Return Abuse Risk Scorer</h1><p class="subtle">Flags return requests for extra verification — never auto-rejects a customer</p></div>
    </header>
    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Live Risk Threshold</h3></div>
        <div class="threshold-row">
          <input type="range" min="0.05" max="0.95" step="0.01" value="${STATE.returnThreshold}" id="return-threshold-slider" class="slider">
          <span class="mono" id="return-threshold-value">${STATE.returnThreshold.toFixed(2)}</span>
        </div>
        <div id="return-threshold-stats" class="threshold-stats"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Confusion Matrix (held-out test set)</h3></div>
        <div id="return-cm"></div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Highest-Risk Return Requests (test set)</h3></div>
      <table class="data-table">
        <thead><tr><th>Return</th><th>Customer</th><th>Amount</th><th>Risk</th><th>Main Factors</th><th>Recommended Action</th></tr></thead>
        <tbody id="return-table-body"></tbody>
      </table>
    </section>
  `;
  const slider = document.getElementById("return-threshold-slider");
  slider.addEventListener("input", () => {
    STATE.returnThreshold = parseFloat(slider.value);
    document.getElementById("return-threshold-value").textContent = STATE.returnThreshold.toFixed(2);
    updateReturnView();
  });
  updateReturnView();
}

function updateReturnView() {
  const p = STATE.returnPipeline;
  const t = STATE.returnThreshold;
  const scores = p.testScoresLR;
  const yTrue = p.testYTrue;
  const pred = scores.map((s) => (s >= t ? 1 : 0));
  const cm = confusionMatrix(yTrue, pred);
  const m = metricsFromCM(cm);

  const statsEl = document.getElementById("return-threshold-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat"><span>Precision</span><strong>${fmtPct(m.precision)}</strong></div>
      <div class="stat"><span>Recall</span><strong>${fmtPct(m.recall)}</strong></div>
      <div class="stat"><span>F1</span><strong>${fmtPct(m.f1)}</strong></div>
      <div class="stat"><span>Flagged</span><strong>${pred.reduce((a, b) => a + b, 0)} / ${pred.length}</strong></div>
    `;
  }
  const cmEl = document.getElementById("return-cm");
  if (cmEl) cmEl.innerHTML = confusionMatrixHTML(cm);

  const refs = STATE.returnRefs;
  const rows = refs.map((r, i) => ({ r, score: scores[i] })).sort((a, b) => b.score - a.score).slice(0, 8);
  const custById = STATE.custById;
  const tbody = document.getElementById("return-table-body");
  if (tbody) {
    tbody.innerHTML = rows.map(({ r, score }) => {
      const cust = custById[r.customerId];
      const factors = [];
      const rate = r.priorReturns / Math.max(1, cust.totalOrders);
      if (rate > 0.2) factors.push(`return rate ${fmtPct(rate)} vs baseline`);
      if (r.daysAfterDelivery > 25) factors.push("requested near return deadline");
      if (r.repeatedReason) factors.push("repeated use of same reason");
      if (cust.previousDisputes > 0) factors.push("previous dispute history");
      if (!factors.length) factors.push("elevated combination of risk factors");
      return `<tr>
        <td class="mono">${r.id}</td>
        <td class="mono">${r.customerId}</td>
        <td class="mono">${fmtINR(r.amount)}</td>
        <td><span class="risk-chip ${score >= t ? "high" : "low"}">${fmtPct(score)}</span></td>
        <td class="small">${factors.join("; ")}</td>
        <td><span class="pill ${score >= t ? "pill-review" : "pill-strong"}">${score >= t ? "Request additional verification" : "Normal processing"}</span></td>
      </tr>`;
    }).join("");
  }
}

/* -------------------------------- timeline --------------------------------- */

function renderTimeline(main, customerId) {
  const ds = STATE.ds;
  const custId = customerId || STATE.ds.chargebacks[0].customerId;
  const options = STATE.ds.customers
    .filter((c) => ds.transactions.some((t) => t.customerId === c.id))
    .slice(0, 60);

  main.innerHTML = `
    <header class="page-head">
      <div><h1>Merchant Risk Timeline</h1><p class="subtle">Unified view across transactions, fraud alerts, returns, refunds, and chargebacks</p></div>
    </header>
    <section class="panel filter-bar">
      <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px;">
          <label class="field-label">Customer</label>
          <select id="timeline-customer-select" class="select" style="width: 100%;">
            ${options.map((c) => `<option value="${c.id}" ${c.id === custId ? "selected" : ""}>${c.id} — ${c.name}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="field-label">Filter Events</label>
          <div class="tabs" id="timeline-category-tabs" style="margin-bottom: 0;">
            <button class="tab active" data-cat="all">All Events</button>
            <button class="tab" data-cat="payment">Payments</button>
            <button class="tab" data-cat="delivery">Deliveries</button>
            <button class="tab" data-cat="return">Returns</button>
            <button class="tab" data-cat="chargeback">Chargebacks</button>
          </div>
        </div>
      </div>
    </section>
    <section class="panel" id="timeline-panel"></section>
  `;

  let currentCategory = "all";

  document.getElementById("timeline-customer-select").addEventListener("change", (e) => {
    location.hash = `#/timeline/${e.target.value}`;
  });

  document.querySelectorAll("#timeline-category-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#timeline-category-tabs .tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.cat;
      renderTimelineForCustomer(custId, currentCategory);
    });
  });

  renderTimelineForCustomer(custId, currentCategory);
}

function renderTimelineForCustomer(custId, catFilter = "all") {
  const ds = STATE.ds;
  const events = [];
  ds.transactions.filter((t) => t.customerId === custId).forEach((t) =>
    events.push({ ts: t.timestamp, label: `Payment ${t.status === "completed" ? "successful" : "failed"} — ${fmtINR(t.amount)}`, type: t.label_fraud ? "alert" : "normal", cat: "payment" })
  );
  ds.orders.filter((o) => o.customerId === custId).forEach((o) => {
    const shipment = ds.shipments.find((s) => s.orderId === o.id);
    if (shipment && shipment.delivered) events.push({ ts: shipment.deliveredTimestamp, label: "Product delivered", type: "normal", cat: "delivery" });
  });
  ds.returns.filter((r) => r.customerId === custId).forEach((r) =>
    events.push({ ts: new Date(Date.now() - r.daysAfterDelivery * 86400000).toISOString(), label: `Return requested — ${r.reason}`, type: r.label_abuse ? "alert" : "normal", cat: "return" })
  );
  ds.chargebacks.filter((c) => c.customerId === custId).forEach((c) =>
    events.push({ ts: c.filedTimestamp, label: `Chargeback filed — ${c.claimLabel}`, type: "chargeback", cat: "chargeback" })
  );
  events.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const filtered = catFilter === "all" ? events : events.filter((e) => e.cat === catFilter);

  const panel = document.getElementById("timeline-panel");
  panel.innerHTML = filtered.length
    ? `<ol class="full-timeline">
        ${filtered.map((e) => `
          <li class="tl-event tl-${e.type}">
            <span class="tl-dot"></span>
            <div class="tl-body"><span class="mono small">${fmtDate(e.ts)}</span><div>${e.label}</div></div>
          </li>`).join("")}
      </ol>`
    : `<p class="subtle">No recorded activity for this customer yet.</p>`;
}

/* -------------------------------- models --------------------------------- */

function renderModels(main) {
  main.innerHTML = `
    <header class="page-head">
      <div><h1>Model Metrics &amp; False-Positive Cost</h1><p class="subtle">Trained on a 70/15/15 train/validation/test split · metrics computed only on the held-out test set</p></div>
    </header>

    <section class="panel">
      <div class="tabs">
        <button class="tab active" data-tab="fraud">Fraud Model</button>
        <button class="tab" data-tab="return">Return-Risk Model</button>
      </div>
      <div id="model-tab-content"></div>
    </section>
  `;
  main.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      main.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderModelTab(btn.dataset.tab);
    });
  });
  renderModelTab("fraud");
}

function renderModelTab(which) {
  const p = which === "fraud" ? STATE.fraudPipeline : STATE.returnPipeline;
  const costState = which === "fraud" ? STATE.fraudCost : STATE.returnCost;
  const content = document.getElementById("model-tab-content");

  content.innerHTML = `
    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Model Comparison (held-out test)</h3></div>
        <table class="data-table compact">
          <thead><tr><th>Model</th><th>Precision</th><th>Recall</th><th>F1</th><th>ROC-AUC</th><th>PR-AUC</th></tr></thead>
          <tbody>
            <tr><td>Logistic Regression</td><td>${fmtPct(p.logreg.testEval.precision)}</td><td>${fmtPct(p.logreg.testEval.recall)}</td><td>${fmtPct(p.logreg.testEval.f1)}</td><td>${fmtPct(p.logreg.testEval.rocAuc)}</td><td>${fmtPct(p.logreg.testEval.prAuc)}</td></tr>
            <tr><td>Bagged Decision Ensemble</td><td>${fmtPct(p.forest.testEval.precision)}</td><td>${fmtPct(p.forest.testEval.recall)}</td><td>${fmtPct(p.forest.testEval.f1)}</td><td>${fmtPct(p.forest.testEval.rocAuc)}</td><td>${fmtPct(p.forest.testEval.prAuc)}</td></tr>
          </tbody>
        </table>
        <p class="fine-print">Test set positive rate: ${fmtPct(p.logreg.testEval.positiveRate)} · n=${p.logreg.testEval.n}. Accuracy is intentionally not the headline metric — with an imbalanced positive rate, a model predicting "no risk" for everyone could score high on accuracy while catching almost nothing.</p>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>ROC Curve (Logistic Regression, test set)</h3></div>
        <div class="chart-box"><canvas id="model-roc-chart"></canvas></div>
      </div>
    </section>

    <section class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h3>Feature Weights (Logistic Regression)</h3></div>
        <div class="chart-box"><canvas id="model-weights-chart"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>False-Positive / False-Negative Cost Inputs</h3></div>
        <div class="cost-inputs">
          <label class="field-label">Cost of a false positive (₹)
            <input type="number" id="fp-cost-input" class="text-input" value="${costState.fp}">
          </label>
          <label class="field-label">Cost of a false negative (₹)
            <input type="number" id="fn-cost-input" class="text-input" value="${costState.fn}">
          </label>
        </div>
        <p class="fine-print">False positive: a legitimate ${which === "fraud" ? "transaction" : "return"} incorrectly flagged — manual review cost + customer friction. False negative: an actual ${which === "fraud" ? "fraudulent transaction" : "abusive return"} that slips through — direct financial loss.</p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Interactive Threshold Simulator</h3></div>
      <div class="threshold-row">
        <input type="range" min="0.05" max="0.95" step="0.01" value="${which === "fraud" ? STATE.fraudThreshold : STATE.returnThreshold}" id="sim-threshold-slider" class="slider">
        <span class="mono" id="sim-threshold-value"></span>
      </div>
      <div id="sim-stats" class="sim-grid"></div>
      <div class="chart-box small"><canvas id="model-cost-chart"></canvas></div>
    </section>
  `;

  scatterROC("model-roc-chart", rocCurvePoints(p.logreg.testEval.n ? p.testYTrue : [], p.testScoresLR), "ROC");
  barChart(
    "model-weights-chart",
    p.logreg.featureNames,
    [{ label: "Weight", data: p.logreg.weights.map((w) => w.weight), color: CHART_COLORS.blue }],
    { horizontal: true }
  );

  function recompute() {
    const t = parseFloat(document.getElementById("sim-threshold-slider").value);
    document.getElementById("sim-threshold-value").textContent = t.toFixed(2);
    const fpCost = parseFloat(document.getElementById("fp-cost-input").value) || 0;
    const fnCost = parseFloat(document.getElementById("fn-cost-input").value) || 0;
    costState.fp = fpCost;
    costState.fn = fnCost;
    if (which === "fraud") STATE.fraudThreshold = t; else STATE.returnThreshold = t;

    const pred = p.testScoresLR.map((s) => (s >= t ? 1 : 0));
    const cm = confusionMatrix(p.testYTrue, pred);
    const m = metricsFromCM(cm);
    const fpTotal = cm.fp * fpCost;
    const fnTotal = cm.fn * fnCost;
    const total = fpTotal + fnTotal;

    document.getElementById("sim-stats").innerHTML = `
      <div class="stat"><span>Precision</span><strong>${fmtPct(m.precision)}</strong></div>
      <div class="stat"><span>Recall</span><strong>${fmtPct(m.recall)}</strong></div>
      <div class="stat"><span>False Positives</span><strong>${cm.fp}</strong></div>
      <div class="stat"><span>False Negatives</span><strong>${cm.fn}</strong></div>
      <div class="stat"><span>Est. FP Cost</span><strong>${fmtINR(fpTotal)}</strong></div>
      <div class="stat"><span>Est. Loss (FN)</span><strong>${fmtINR(fnTotal)}</strong></div>
      <div class="stat highlight"><span>Total Estimated Loss</span><strong>${fmtINR(total)}</strong></div>
    `;

    // Cost-vs-threshold curve
    const thresholds = [];
    const costs = [];
    for (let tt = 0.05; tt <= 0.95; tt += 0.05) {
      const pr = p.testScoresLR.map((s) => (s >= tt ? 1 : 0));
      const c = confusionMatrix(p.testYTrue, pr);
      thresholds.push(tt.toFixed(2));
      costs.push(c.fp * fpCost + c.fn * fnCost);
    }
    lineChart("model-cost-chart", thresholds, [{ label: "Total estimated loss (₹)", data: costs, color: CHART_COLORS.amber }]);
  }

  document.getElementById("sim-threshold-slider").addEventListener("input", recompute);
  document.getElementById("fp-cost-input").addEventListener("input", recompute);
  document.getElementById("fn-cost-input").addEventListener("input", recompute);
  recompute();
}

/* -------------------------------- demo scenarios --------------------------------- */

function renderDemo(main) {
  main.innerHTML = `
    <header class="page-head">
      <div><h1>Demo Scenarios</h1><p class="subtle">Preset walkthroughs on synthetic data — jump straight to a representative case</p></div>
    </header>
    <section class="demo-grid">
      ${demoCard("Scenario 1", "Strong Defense", "Customer claims the item was never received, but delivery is fully documented.", "strong")}
      ${demoCard("Scenario 2", "Weak Evidence", "Customer claims the transaction was unauthorized; authentication evidence is thin.", "weak")}
      ${demoCard("Scenario 3", "Fraud Spike", "A cluster of high-risk transactions appears in a short window.", "fraud")}
      ${demoCard("Scenario 4", "Suspicious Return Pattern", "A customer with a high return rate requests another high-value return.", "return")}
    </section>
    <section class="panel" id="demo-output"></section>
  `;
  main.querySelectorAll(".demo-card").forEach((card) => {
    card.addEventListener("click", () => runDemoScenario(card.dataset.key));
  });
}

function demoCard(eyebrow, title, desc, key) {
  return `
    <div class="demo-card" data-key="${key}">
      <div class="demo-eyebrow">${eyebrow}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <span class="demo-cta">Run scenario →</span>
    </div>
  `;
}

function runDemoScenario(key) {
  const out = document.getElementById("demo-output");
  const ds = STATE.ds;

  if (key === "strong" || key === "weak") {
    // find a real case in the dataset whose computed score matches the scenario intent
    const candidates = ds.chargebacks
      .map((c) => ({ c, evalR: STATE.evalCache[c.id] }))
      .sort((a, b) => (key === "strong" ? b.evalR.score - a.evalR.score : a.evalR.score - b.evalR.score));
    const pick = candidates[0];
    out.innerHTML = `
      <div class="panel-head"><h3>${key === "strong" ? "Scenario 1 — Strong Defense" : "Scenario 2 — Weak Evidence"}</h3></div>
      <p class="subtle">Matched to case ${pick.c.id} in the current dataset (defense strength ${pick.evalR.score}%).</p>
      <a href="#/cases/${pick.c.id}" class="btn btn-primary">Open Case ${pick.c.id}</a>
    `;
    return;
  }

  if (key === "fraud") {
    const scores = STATE.fraudPipeline.testScoresLR;
    const rate = scores.filter((s) => s >= STATE.fraudThreshold).length / scores.length;
    const baseline = 0.02;
    out.innerHTML = `
      <div class="panel-head"><h3>Scenario 3 — Fraud Spike Detected</h3></div>
      <div class="spike-box">
        <div><span>Normal suspicious-transaction rate</span><strong>${fmtPct(baseline)}</strong></div>
        <div><span>Current flagged rate (held-out test)</span><strong>${fmtPct(rate)}</strong></div>
        <div><span>Increase</span><strong>${(rate / baseline).toFixed(1)}×</strong></div>
        <div><span>Affected transactions</span><strong>${scores.filter((s) => s >= STATE.fraudThreshold).length}</strong></div>
      </div>
      <p class="fine-print">Recommended action: investigate the affected transaction cluster in the Fraud Detector view. This is a monitoring alert, not an automatic block.</p>
      <a href="#/fraud" class="btn btn-primary">Open Fraud Detector</a>
    `;
    return;
  }

  if (key === "return") {
    const scored = STATE.returnRefs.map((r, i) => ({ r, score: STATE.returnPipeline.testScoresLR[i] })).sort((a, b) => b.score - a.score)[0];
    const cust = STATE.custById[scored.r.customerId];
    out.innerHTML = `
      <div class="panel-head"><h3>Scenario 4 — Suspicious Return Pattern</h3></div>
      <div class="spike-box">
        <div><span>Return</span><strong class="mono">${scored.r.id}</strong></div>
        <div><span>Customer</span><strong class="mono">${cust.id}</strong></div>
        <div><span>Return Risk</span><strong>${fmtPct(scored.score)}</strong></div>
        <div><span>Prior returns</span><strong>${scored.r.priorReturns} of ${cust.totalOrders} orders</strong></div>
      </div>
      <p class="fine-print">Recommended action: request additional verification and route to manual review — never auto-reject a customer from a score alone.</p>
      <a href="#/returns" class="btn btn-primary">Open Return Risk Scorer</a>
    `;
  }
}
