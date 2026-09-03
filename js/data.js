/**
 * ChargeShield AI — Synthetic Data Layer
 *
 * All data below is generated, seeded, and clearly synthetic. No real
 * customer, payment, or account data is used anywhere in this demo.
 *
 * Ground-truth fraud/return-abuse labels are produced by a hidden generating
 * process (a noisy weighted rule) that is DIFFERENT from — but correlated
 * with — the features the model is trained on. This mirrors a real dataset:
 * the model has to learn the relationship rather than have it handed to it,
 * and it will not achieve 100% precision/recall, which is realistic and
 * intentional (see the false-positive cost module).
 */

const CLAIM_TYPES = [
  { id: "not_received", label: "Item not received" },
  { id: "unauthorized", label: "Transaction unauthorized" },
  { id: "not_as_described", label: "Item not as described" },
  { id: "duplicate_charge", label: "Duplicate charge" },
];

const RETURN_REASONS = [
  "Item damaged on arrival",
  "Not as described",
  "Changed my mind",
  "Wrong item received",
  "Found cheaper elsewhere",
];

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function genCustomers(n) {
  const customers = [];
  for (let i = 0; i < n; i++) {
    const accountAgeDays = RNG.int(1, 1400);
    const totalOrders = Math.max(1, Math.round(RNG.gaussian(accountAgeDays / 45, 4)));
    const baseOrderValue = Math.round(RNG.float(400, 6000));
    customers.push({
      id: `CUST-${1000 + i}`,
      name: `Customer ${1000 + i}`,
      accountAgeDays,
      totalOrders: Math.max(1, totalOrders),
      avgOrderValue: baseOrderValue,
      previousDisputes: RNG.bool(0.08) ? RNG.int(1, 3) : 0,
      previousFailedPayments: RNG.bool(0.15) ? RNG.int(1, 5) : 0,
      knownDevice: RNG.bool(0.82),
      deviceHistoryMonths: RNG.int(0, 36),
    });
  }
  return customers;
}

function genTransactionsAndOrders(customers, n) {
  const transactions = [];
  const orders = [];
  const shipments = [];
  const supportTickets = [];

  for (let i = 0; i < n; i++) {
    const cust = RNG.pick(customers);
    const amountMultiplier = RNG.bool(0.06) ? RNG.float(4, 10) : RNG.float(0.3, 2.2);
    const amount = Math.max(99, Math.round(cust.avgOrderValue * amountMultiplier));
    const attemptsInWindow = RNG.bool(0.1) ? RNG.int(3, 8) : RNG.int(1, 2);
    const newDevice = RNG.bool(cust.knownDevice ? 0.06 : 0.6) ? 1 : 0;
    const isNewAccount = cust.accountAgeDays < 30 ? 1 : 0;

    // Hidden generating rule for ground-truth fraud label (not shown to model directly as a formula)
    const fraudLogit =
      -3.4 +
      1.15 * Math.log(amountMultiplier + 0.1) +
      0.55 * attemptsInWindow +
      1.4 * newDevice +
      1.1 * isNewAccount +
      0.6 * cust.previousFailedPayments +
      0.9 * cust.previousDisputes +
      RNG.gaussian(0, 0.6);
    const fraudProb = sigmoid(fraudLogit);
    const label_fraud = RNG.bool(fraudProb) ? 1 : 0;

    const authResult = label_fraud && RNG.bool(0.55) ? 0 : (RNG.bool(0.97) ? 1 : 0);
    const dayOffset = RNG.int(0, 220);
    const authTimestamp = new Date(Date.now() - dayOffset * 86400000 - RNG.int(0, 80000) * 1000);

    const txn = {
      id: `TXN-${20000 + i}`,
      customerId: cust.id,
      amount,
      timestamp: authTimestamp.toISOString(),
      authResult,
      status: authResult ? "completed" : "failed",
      attemptsInWindow,
      newDevice,
      isNewAccount,
      label_fraud,
      fraudProbHidden: fraudProb, // kept only for internal reference/debugging, never shown as "the answer"
    };
    transactions.push(txn);

    // Not every transaction becomes a fulfilled order (failed payments don't)
    if (authResult) {
      const invoiceTimeSkewMinutes = RNG.bool(0.06) ? RNG.int(180, 600) : RNG.int(0, 25);
      const orderTimestamp = new Date(authTimestamp.getTime() + RNG.int(1, 30) * 60000);
      const invoiceTimestamp = new Date(orderTimestamp.getTime() + invoiceTimeSkewMinutes * 60000);
      const invoiceAmountMismatch = RNG.bool(0.05);
      const order = {
        id: `ORD-${30000 + i}`,
        transactionId: txn.id,
        customerId: cust.id,
        orderTimestamp: orderTimestamp.toISOString(),
        invoiceTimestamp: invoiceTimestamp.toISOString(),
        invoiceAmount: invoiceAmountMismatch ? Math.round(amount * RNG.float(0.7, 0.95)) : amount,
        orderAmount: amount,
        confirmed: RNG.bool(0.97),
        products: [RNG.pick(["Wireless Earbuds", "Desk Lamp", "Running Shoes", "Backpack", "Coffee Grinder", "Yoga Mat", "Bluetooth Speaker", "Water Bottle"])],
      };
      orders.push(order);

      const shipped = RNG.bool(0.94);
      const delivered = shipped && RNG.bool(0.9);
      const shippedTs = shipped ? new Date(orderTimestamp.getTime() + RNG.int(1, 3) * 86400000) : null;
      const deliveredTs = delivered ? new Date(shippedTs.getTime() + RNG.int(1, 5) * 86400000) : null;
      shipments.push({
        orderId: order.id,
        shipped,
        trackingNumber: shipped ? `TRK${RNG.int(100000000, 999999999)}` : null,
        shippedTimestamp: shippedTs ? shippedTs.toISOString() : null,
        delivered,
        deliveredTimestamp: deliveredTs ? deliveredTs.toISOString() : null,
        proofOfDelivery: delivered && RNG.bool(0.85),
        recipientConfirmation: delivered && RNG.bool(0.6),
      });

      if (RNG.bool(0.18)) {
        supportTickets.push({
          id: `TCK-${RNG.int(10000, 99999)}`,
          customerId: cust.id,
          transactionId: txn.id,
          type: RNG.pick(["shipping_question", "refund_request", "complaint", "general_inquiry"]),
          timestamp: new Date(orderTimestamp.getTime() + RNG.int(1, 10) * 86400000).toISOString(),
        });
      }
    }
  }
  return { transactions, orders, shipments, supportTickets };
}

function genReturns(customers, orders, n) {
  const returns = [];
  const byCustomerReturns = {};
  for (let i = 0; i < n; i++) {
    const order = RNG.pick(orders);
    const cust = customers.find((c) => c.id === order.customerId);
    const priorReturns = byCustomerReturns[cust.id] || 0;

    const daysAfterDelivery = RNG.int(1, 45);
    const nearDeadline = daysAfterDelivery > 25 ? 1 : 0;
    const repeatedReason = RNG.bool(0.2) ? 1 : 0;

    const abuseLogit =
      -3.0 +
      0.9 * (priorReturns / Math.max(1, cust.totalOrders)) * 10 +
      0.8 * nearDeadline +
      1.1 * repeatedReason +
      0.7 * cust.previousDisputes +
      0.4 * (order.orderAmount > 3000 ? 1 : 0) +
      RNG.gaussian(0, 0.5);
    const abuseProb = sigmoid(abuseLogit);
    const label_abuse = RNG.bool(abuseProb) ? 1 : 0;

    byCustomerReturns[cust.id] = priorReturns + 1;

    returns.push({
      id: `RET-${40000 + i}`,
      customerId: cust.id,
      orderId: order.id,
      amount: order.orderAmount,
      reason: RNG.pick(RETURN_REASONS),
      daysAfterDelivery,
      priorReturns,
      repeatedReason,
      label_abuse,
    });
  }
  return returns;
}

function genChargebacks(customers, transactions, orders, shipments, supportTickets, n) {
  const chargebacks = [];
  const orderByTxn = Object.fromEntries(orders.map((o) => [o.transactionId, o]));
  const shipmentByOrder = Object.fromEntries(shipments.map((s) => [s.orderId, s]));
  const eligibleTxns = transactions.filter((t) => t.authResult === 1);

  const chosen = [];
  const used = new Set();
  while (chosen.length < n && chosen.length < eligibleTxns.length) {
    const t = RNG.pick(eligibleTxns);
    if (!used.has(t.id)) {
      used.add(t.id);
      chosen.push(t);
    }
  }

  chosen.forEach((txn, i) => {
    const cust = customers.find((c) => c.id === txn.customerId);
    const order = orderByTxn[txn.id];
    const shipment = order ? shipmentByOrder[order.id] : null;
    const claim = RNG.pick(CLAIM_TYPES);
    const tickets = supportTickets.filter((s) => s.transactionId === txn.id);
    const filedTimestamp = new Date(new Date(txn.timestamp).getTime() + RNG.int(5, 40) * 86400000);

    chargebacks.push({
      id: `CB-${10000 + i}`,
      transactionId: txn.id,
      customerId: cust.id,
      orderId: order ? order.id : null,
      claimType: claim.id,
      claimLabel: claim.label,
      amount: txn.amount,
      filedTimestamp: filedTimestamp.toISOString(),
      status: "NEW",
      priority: txn.amount > 5000 ? "HIGH" : txn.amount > 1500 ? "MEDIUM" : "LOW",
      hasSupportTicket: tickets.length > 0,
      // internal-only ground truth for demo scoring calibration; never exposed as a claim of certainty
      _syntheticTruth: cust.previousDisputes > 0 && !shipment?.delivered ? "likely_valid_dispute" : "likely_defensible",
    });
  });

  return chargebacks;
}

function buildDataset() {
  RNG.reset(20260209);
  const customers = genCustomers(220);
  const { transactions, orders, shipments, supportTickets } = genTransactionsAndOrders(customers, 900);
  const returns = genReturns(customers, orders, 260);
  const chargebacks = genChargebacks(customers, transactions, orders, shipments, supportTickets, 34);

  return { customers, transactions, orders, shipments, supportTickets, returns, chargebacks };
}

const DATASET = buildDataset();
