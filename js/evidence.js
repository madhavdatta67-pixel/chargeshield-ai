/**
 * ChargeShield AI — Feature Engineering + Evidence Verification Engine
 *
 * Two things live here:
 *  1. Feature builders that turn raw synthetic records into model-ready
 *     vectors for the fraud and return-risk classifiers.
 *  2. The Evidence Verification Engine — a transparent, rule-based,
 *     itemized scoring system for the Chargeback Defense Strength Score.
 *     This is intentionally NOT a black-box model: every point added or
 *     subtracted is shown to the merchant with a plain-language reason,
 *     matching the brief's requirement for explainable, non-mysterious
 *     scoring (feature-attribution style, SHAP-like in spirit).
 */

const FRAUD_FEATURE_NAMES = [
  "amount_vs_customer_avg",
  "attempts_in_window",
  "account_age_days",
  "previous_failed_payments",
  "previous_disputes",
  "new_device_flag",
];

function buildFraudFeatures(transactions, customerById) {
  const X = [], y = [], refs = [];
  for (const t of transactions) {
    const cust = customerById[t.customerId];
    if (!cust) continue;
    X.push([
      t.amount / cust.avgOrderValue,
      t.attemptsInWindow,
      cust.accountAgeDays,
      cust.previousFailedPayments,
      cust.previousDisputes,
      t.newDevice,
    ]);
    y.push(t.label_fraud);
    refs.push(t);
  }
  return { X, y, refs };
}

const RETURN_FEATURE_NAMES = [
  "prior_return_rate_pct",
  "days_after_delivery",
  "order_amount",
  "repeated_reason_flag",
  "previous_disputes",
  "account_age_days",
];

function buildReturnFeatures(returns, customerById) {
  const X = [], y = [], refs = [];
  for (const r of returns) {
    const cust = customerById[r.customerId];
    if (!cust) continue;
    X.push([
      (r.priorReturns / Math.max(1, cust.totalOrders)) * 100,
      r.daysAfterDelivery,
      r.amount,
      r.repeatedReason,
      cust.previousDisputes,
      cust.accountAgeDays,
    ]);
    y.push(r.label_abuse);
    refs.push(r);
  }
  return { X, y, refs };
}

/* ------------------------------------------------------------------ */
/* Evidence Verification Engine                                        */
/* ------------------------------------------------------------------ */

function hoursBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 3600000;
}

/**
 * Build the full evidence bundle for a chargeback case by pulling every
 * related record together, exactly as described in the brief's
 * "scattered across multiple systems" problem statement.
 */
function assembleEvidence(cbCase, ds) {
  const txn = ds.transactions.find((t) => t.id === cbCase.transactionId);
  const order = cbCase.orderId ? ds.orders.find((o) => o.id === cbCase.orderId) : null;
  const shipment = order ? ds.shipments.find((s) => s.orderId === order.id) : null;
  const customer = ds.customers.find((c) => c.id === cbCase.customerId);
  const tickets = ds.supportTickets.filter((s) => s.transactionId === cbCase.transactionId);
  const priorReturns = ds.returns.filter((r) => r.customerId === cbCase.customerId);

  return { txn, order, shipment, customer, tickets, priorReturns };
}

/**
 * Run the evidence checks and produce an itemized, explainable score.
 * Returns: { score, recommendation, checks[], factors[] }
 * - checks: pass/fail/warn list for the "EVIDENCE" panel
 * - factors: signed point contributions for the "AI ANALYSIS" panel
 */
function evaluateChargebackCase(cbCase, ds) {
  const ev = assembleEvidence(cbCase, ds);
  const checks = [];
  const factors = [];
  let score = 50; // neutral baseline before evidence is weighed

  function add(name, present, weight, weightIfMissing, note, warnNote) {
    if (present) {
      score += weight;
      checks.push({ label: name, status: "pass", note });
      if (weight !== 0) factors.push({ label: note, points: weight });
    } else {
      score += weightIfMissing;
      checks.push({ label: name, status: weightIfMissing < 0 ? "fail" : "warn", note: warnNote || `${name} unavailable` });
      if (weightIfMissing !== 0) factors.push({ label: warnNote || `${name} unavailable`, points: weightIfMissing });
    }
  }

  // Payment evidence
  add(
    "Payment Verified",
    !!ev.txn && ev.txn.authResult === 1,
    18,
    -14,
    "Verified payment authentication",
    "Payment authentication could not be confirmed"
  );

  // Order evidence
  add(
    "Order Confirmed",
    !!ev.order && ev.order.confirmed,
    10,
    -8,
    "Order confirmation on file",
    "No order confirmation on file"
  );

  add(
    "Invoice Available",
    !!ev.order,
    6,
    -4,
    "Invoice record available",
    "No invoice record found"
  );

  // Amount consistency
  if (ev.order) {
    const amountsMatch = ev.order.invoiceAmount === ev.order.orderAmount;
    add(
      "Order & Invoice Amounts Match",
      amountsMatch,
      10,
      -12,
      "Order and invoice amounts match",
      "Order and invoice amounts do not match"
    );
  }

  // Timestamp consistency
  if (ev.order) {
    const gapHours = hoursBetween(ev.order.orderTimestamp, ev.order.invoiceTimestamp);
    const consistent = gapHours <= 2;
    add(
      "Timestamps Consistent",
      consistent,
      6,
      -15,
      "Order and invoice timestamps are consistent",
      `Timestamp gap of ~${gapHours.toFixed(1)}h between order and invoice — potential inconsistency`
    );
  }

  // Delivery evidence
  add(
    "Product Shipped",
    !!ev.shipment && ev.shipment.shipped,
    6,
    -5,
    "Shipment record confirmed",
    "No shipment record found"
  );
  add(
    "Tracking Available",
    !!ev.shipment && !!ev.shipment.trackingNumber,
    6,
    -4,
    "Tracking number on file",
    "No tracking number available"
  );
  add(
    "Product Delivered",
    !!ev.shipment && ev.shipment.delivered,
    22,
    -18,
    "Delivery successfully confirmed",
    "No confirmed delivery on record"
  );
  add(
    "Proof of Delivery",
    !!ev.shipment && ev.shipment.proofOfDelivery,
    12,
    -8,
    "Proof-of-delivery record available",
    "Proof-of-delivery record unavailable"
  );
  add(
    "Recipient Confirmation",
    !!ev.shipment && ev.shipment.recipientConfirmation,
    4,
    0,
    "Recipient confirmation captured",
    "Recipient confirmation not available"
  );

  // Customer interaction evidence
  add(
    "Customer Communication on File",
    ev.tickets.length > 0,
    4,
    -8,
    "Support interaction history available",
    "No customer communication record"
  );

  // Historical risk evidence
  const hasPriorDisputes = !!ev.customer && ev.customer.previousDisputes > 0;
  add(
    "Clean Dispute History",
    !hasPriorDisputes,
    12,
    -10,
    "Customer account has successful history",
    `Previous dispute history detected (${ev.customer ? ev.customer.previousDisputes : "?"})`
  );

  const refundBeforeDispute = ev.tickets.some((t) => t.type === "refund_request");
  add(
    "No Refund Requested Before Dispute",
    !refundBeforeDispute,
    8,
    -6,
    "No refund request before dispute",
    "Refund was requested before the dispute was filed"
  );

  score = Math.max(0, Math.min(100, Math.round(score)));

  let recommendation, recColor;
  if (score >= 75) { recommendation = "STRONGLY DEFEND"; recColor = "strong"; }
  else if (score >= 55) { recommendation = "DEFEND WITH ADDITIONAL EVIDENCE"; recColor = "moderate"; }
  else if (score >= 32) { recommendation = "MANUAL REVIEW REQUIRED"; recColor = "review"; }
  else { recommendation = "WEAK EVIDENCE / CONSIDER ACCEPTING"; recColor = "weak"; }

  factors.sort((a, b) => b.points - a.points);

  return { evidence: ev, checks, factors, score, recommendation, recColor };
}

/**
 * Deterministic, template-based draft response generator. This is NOT a
 * free-form language model call — it only ever fills in fields from
 * VERIFIED evidence, and explicitly labels anything that is missing. It
 * never invents delivery confirmations, timestamps, or communications.
 */
function generateDraftResponse(cbCase, evalResult) {
  const { evidence: ev } = evalResult;
  const na = (v, formatter) => (v === undefined || v === null || v === false ? "Unavailable — not present in system records." : (formatter ? formatter(v) : v));

  const lines = [];
  lines.push(`DISPUTE RESPONSE — Case ${cbCase.id}`);
  lines.push(`Claim: "${cbCase.claimLabel}"`);
  lines.push("");
  lines.push("TRANSACTION");
  lines.push(`  Transaction ID: ${ev.txn ? ev.txn.id : "Unavailable"}`);
  lines.push(`  Amount: ${ev.txn ? "₹" + ev.txn.amount.toLocaleString("en-IN") : "Unavailable"}`);
  lines.push(`  Authenticated: ${ev.txn ? (ev.txn.authResult ? "Yes — authentication succeeded" : "No — authentication could not be confirmed") : "Unavailable"}`);
  lines.push("");
  lines.push("ORDER FULFILLMENT");
  lines.push(`  Order confirmed: ${ev.order ? (ev.order.confirmed ? "Yes" : "No") : "Unavailable"}`);
  lines.push(`  Products: ${ev.order ? ev.order.products.join(", ") : "Unavailable"}`);
  lines.push(`  Invoice vs order amount match: ${ev.order ? (ev.order.invoiceAmount === ev.order.orderAmount ? "Match" : "Mismatch — flagged for review") : "Unavailable"}`);
  lines.push("");
  lines.push("DELIVERY CONFIRMATION");
  lines.push(`  Shipped: ${ev.shipment ? (ev.shipment.shipped ? "Yes" : "No") : "Unavailable"}`);
  lines.push(`  Tracking number: ${ev.shipment && ev.shipment.trackingNumber ? ev.shipment.trackingNumber : "Unavailable"}`);
  lines.push(`  Delivered: ${ev.shipment ? (ev.shipment.delivered ? "Yes, confirmed delivered" : "Not confirmed") : "Unavailable"}`);
  lines.push(`  Proof of delivery: ${ev.shipment && ev.shipment.proofOfDelivery ? "On file" : "Unavailable"}`);
  lines.push("");
  lines.push("CUSTOMER INTERACTION HISTORY");
  lines.push(`  Support tickets on file: ${ev.tickets.length}`);
  if (ev.tickets.length) {
    ev.tickets.forEach((t) => lines.push(`    - ${t.type} on ${new Date(t.timestamp).toLocaleDateString()}`));
  } else {
    lines.push("    None found — no prior communication on record.");
  }
  lines.push("");
  lines.push("SUPPORTING EVIDENCE ATTACHED");
  evalResult.checks.filter((c) => c.status === "pass").forEach((c) => lines.push(`  ✓ ${c.label}`));
  lines.push("");
  lines.push("EVIDENCE GAPS (explicitly disclosed, not fabricated)");
  const gaps = evalResult.checks.filter((c) => c.status !== "pass");
  if (gaps.length) gaps.forEach((c) => lines.push(`  ⚠ ${c.note}`));
  else lines.push("  None identified.");
  lines.push("");
  lines.push("CONCLUSION (AI-drafted summary — verified facts only, editable before submission)");
  lines.push(`  Defense Strength Score: ${evalResult.score}/100`);
  lines.push(`  Recommendation: ${evalResult.recommendation}`);
  lines.push(
    evalResult.score >= 55
      ? "  Based on the verified records above, the available evidence supports disputing this chargeback."
      : "  Verified evidence is incomplete or inconsistent. Manual review is recommended before responding."
  );
  return lines.join("\n");
}
