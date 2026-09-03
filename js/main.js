/* ChargeShield AI — bootstrap
 * Wires the synthetic dataset -> feature engineering -> ML pipelines ->
 * evidence engine -> UI router. Everything here runs client-side, in the
 * browser, at page load. No server, no network calls, no real data.
 */

const STATE = {
  ds: null,
  custById: {},
  fraudPipeline: null,
  returnPipeline: null,
  fraudRefs: null,
  returnRefs: null,
  fraudThreshold: 0.5,
  returnThreshold: 0.5,
  fraudCost: { fp: 200, fn: 5000 },
  returnCost: { fp: 150, fn: 2000 },
  caseStore: {},
  evalCache: {},
};

function initCaseStore(chargebacks) {
  const store = {};
  chargebacks.forEach((c, i) => {
    // Give the demo a bit of visible pipeline variety instead of every
    // case sitting at NEW — reflects a merchant who has been triaging.
    const stageIdx = [0, 0, 1, 1, 2, 2, 3, 4, 5][i % 9];
    const stage = CASE_STAGES ? CASE_STAGES[stageIdx] : "NEW";
    store[c.id] = {
      status: stage,
      reviewer: "",
      audit: [{ ts: c.filedTimestamp, note: "Case created — evidence collection started automatically" }],
    };
  });
  return store;
}

function boot() {
  RNG.reset(20260209);
  const ds = DATASET;
  STATE.ds = ds;
  STATE.custById = Object.fromEntries(ds.customers.map((c) => [c.id, c]));

  // --- Fraud model pipeline ---
  const fraudData = buildFraudFeatures(ds.transactions, STATE.custById);
  STATE.fraudRefs = fraudData.refs;
  STATE.fraudPipeline = runPipeline(fraudData.X, fraudData.y, {
    fpCost: STATE.fraudCost.fp,
    fnCost: STATE.fraudCost.fn,
    featureNames: FRAUD_FEATURE_NAMES,
  });
  STATE.fraudThreshold = STATE.fraudPipeline.logreg.testEval.threshold;

  // --- Return-risk model pipeline ---
  const returnData = buildReturnFeatures(ds.returns, STATE.custById);
  STATE.returnRefs = returnData.refs;
  STATE.returnPipeline = runPipeline(returnData.X, returnData.y, {
    fpCost: STATE.returnCost.fp,
    fnCost: STATE.returnCost.fn,
    featureNames: RETURN_FEATURE_NAMES,
  });
  STATE.returnThreshold = STATE.returnPipeline.logreg.testEval.threshold;

  // --- Evidence evaluation for every chargeback case (cached once) ---
  ds.chargebacks.forEach((c) => {
    STATE.evalCache[c.id] = evaluateChargebackCase(c, ds);
  });

  STATE.caseStore = initCaseStore(ds.chargebacks);

  renderShell();
  router();
  window.addEventListener("hashchange", router);
}

document.addEventListener("DOMContentLoaded", boot);
