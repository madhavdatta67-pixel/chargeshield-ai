# ChargeShield AI

**Detect risk early. Preserve evidence. Defend revenue.**

A merchant risk-intelligence platform built around an **AI Chargeback Evidence Responder**, backed by a fraud risk detector and a return-abuse risk scorer — all connected through one explainable, human-reviewed workflow.

This is a static, client-side web app. Open `index.html` in a browser (or serve the folder) — no backend, no build step, no install required. Everything, including the machine learning, runs in the browser at page load.

---

## Problem

When a merchant receives a chargeback, the evidence needed to respond — payment status, order confirmation, shipping and delivery proof, customer communications, account history — is scattered across separate systems. Pulling it together by hand is slow, inconsistent, and expensive, and merchants often lose defensible disputes simply because the evidence wasn't assembled and verified in time.

Separately, fraud and return abuse are usually judged by gut feel or blunt accuracy numbers that hide the real trade-off: catching more risk always means flagging more legitimate customers too.

## Solution

ChargeShield AI connects three things that are normally handled in isolation:

```
Fraud Signal → Risk Detected → Evidence Collected → Evidence Verified
             → AI Explanation → Human Review → Actionable Response
```

1. **Chargeback Evidence Responder** (main feature) — assembles every related record for a disputed transaction, runs it through an **Evidence Verification Engine**, produces an explainable **Defense Strength Score (0–100)**, and drafts a response built only from verified facts.
2. **Fraud Risk Detector** — scores incoming transactions using a model trained on synthetic data, with a live threshold and honest precision/recall trade-offs.
3. **Return Abuse Risk Scorer** — same approach applied to return requests, routing high-risk cases to manual review rather than auto-rejecting anyone.

A **Merchant Risk Timeline** ties a single customer's transactions, returns, fraud alerts, and chargebacks into one view, and a **Case Management** workflow (`NEW → EVIDENCE COLLECTION → VERIFICATION → AI ANALYSIS → MANUAL REVIEW → READY TO RESPOND → SUBMITTED → RESOLVED`) tracks each dispute with an audit log.

**The system never makes an irreversible financial decision on its own.** Every recommendation is a routing decision — defend, gather more evidence, or send to a human — and every "AI Analysis" is a transparent, itemized list of point contributions rather than a black-box number.

---

## Architecture

This build is intentionally a **single static app**, not a microservice fleet — the brief asks not to over-engineer, and everything here (data generation, feature engineering, model training, evaluation, evidence scoring, UI) genuinely runs client-side without needing a server to demonstrate the full pipeline end to end.

```
index.html
├── js/prng.js       seeded RNG — reproducible synthetic data & training runs
├── js/data.js       synthetic dataset generator (customers, transactions,
│                    orders, shipments, returns, chargebacks, support tickets)
├── js/ml.js         logistic regression + bagged decision-stump ensemble,
│                    written from scratch; train/val/test split; metrics
├── js/evidence.js   feature engineering + explainable evidence-verification
│                    engine + template-based draft response generator
├── js/charts.js     Chart.js wrappers (line/bar/doughnut/ROC)
├── js/ui.js         router + all page renderers
├── js/main.js       bootstraps state: builds dataset, trains models,
│                    evaluates every chargeback case, starts the app
└── styles.css       design system
```

A production version of this system would split `data.js` into a real Postgres-backed ingestion layer, move `ml.js` into a Python/FastAPI service (scikit-learn, proper cross-validation, persisted models), and move `evidence.js`'s scoring into a rules engine service — the module boundaries above are drawn so that split is straightforward later.

---

## Dataset & synthetic data policy

All data is **generated in-browser from a seeded random number generator** — no real customer, payment, or account data is used anywhere. Every screen that shows data is labeled as synthetic demo data in the sidebar.

Ground-truth fraud/return-abuse labels are produced by a **hidden noisy generating rule** that is correlated with, but not identical to, the features the models are trained on — this deliberately mirrors a real dataset, where the model has to learn a relationship rather than have it handed to it, and cannot reach 100% precision or recall.

Generated per run: 220 customers, 900 transactions, ~750 fulfilled orders + shipments, 260 return requests, 34 chargeback cases, and a scattering of support tickets.

## ML methodology

- **Split:** 70% train / 15% validation / 15% held-out test, computed once per model. The test set is never used to fit parameters or choose the operating threshold.
- **Models:** logistic regression (trained via batch gradient descent with L2 regularization) and a small bagged decision-stump ensemble, so the app can honestly compare two model families rather than presenting a single number as ground truth.
- **Threshold selection:** the default operating threshold is chosen on the **validation** set by minimizing `FP × false-positive cost + FN × false-negative cost` — not by accuracy. Final precision/recall/F1/ROC-AUC/PR-AUC/confusion matrix are then reported on the **test** set at that threshold, and are recomputed live if you move the threshold slider.
- **Why not accuracy:** both fraud and return abuse are the minority class in this data (~20% positive rate in the synthetic sample). A model that predicts "legitimate" for everything scores well above 80% accuracy while catching nothing — which is why this app leads with precision, recall, and cost, and shows accuracy only as a secondary figure.
- **Explainability:** the fraud/return models expose their logistic-regression feature weights directly (Model Metrics page). The Chargeback Defense Score is not a model at all — it's an itemized, auditable rule-based score, shown in full in the "AI Analysis" panel of every case.

## False-positive cost analysis

The Model Metrics page includes an interactive threshold simulator: moving the slider recomputes the confusion matrix on the held-out test set live, along with the estimated cost of `(false positives × FP cost) + (false negatives × FN cost)`, using merchant-editable cost inputs (defaults: fraud FP ₹200 / FN ₹5,000; return-abuse FP ₹150 / FN ₹2,000). A cost-vs-threshold chart shows the full curve so the trade-off is visible, not just the single chosen point.

## Limitations & ethical considerations

- This is a **demo built on synthetic data**. The measured precision/recall are real computations on that synthetic held-out set, but they say nothing about performance on real transactions — a production deployment would need real (properly consented, anonymized) historical data and ongoing monitoring for drift.
- The evidence-verification rule weights (Defense Score) were set by hand to be transparent and auditable, not learned from labeled outcome data. A production version should validate and calibrate these weights against real dispute outcomes.
- No claim in this app asserts certainty about any individual ("this customer is fraudulent"). Outputs are framed as risk patterns and recommendations for review.
- All flows terminate in a human decision point for anything financially consequential — auto-blocking, auto-rejecting returns, or auto-submitting a dispute response is out of scope by design.
- The app is strictly defensive: it contains no fraud techniques, payment-bypass instructions, or methods to evade detection, and does not use or request real payment credentials.

---

## Using the app

- **Overview** — top-line KPIs and portfolio-level charts.
- **Chargeback Cases** — the full case list; click a row for the case detail page (defense score, evidence checklist, AI analysis, draft response generator, case pipeline, audit log).
- **Fraud Detector** / **Return Risk** — live threshold, confusion matrix, and the highest-risk items in the test set with plain-language reasons.
- **Risk Timeline** — pick a customer to see their unified event history.
- **Model Metrics & Cost** — model comparison, ROC curve, feature weights, and the interactive threshold/cost simulator, for both models.
- **Demo Scenarios** — one-click walkthroughs matching the brief's four example scenarios (strong defense, weak evidence, fraud spike, suspicious return pattern).

Case status changes and generated drafts are kept in memory for the session (refreshing the page resets the demo back to its seeded starting state).
