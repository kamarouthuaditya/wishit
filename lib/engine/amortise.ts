/**
 * Loan maths. Real amortisation, not a progress bar.
 */

export interface AmortisationRow {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

/**
 * EMI = P x i x (1+i)^n / ((1+i)^n - 1), i = annual/12/100.
 * Falls back to straight-line when the rate is 0 (no-cost EMI).
 */
export function emiFor(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  if (tenureMonths <= 0) return 0;
  const i = annualRatePct / 12 / 100;
  if (i === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + i, tenureMonths);
  return (principal * i * factor) / (factor - 1);
}

/** Tenure implied by a given EMI. Returns null if the EMI never clears interest. */
export function tenureFor(
  principal: number,
  annualRatePct: number,
  emi: number,
): number | null {
  if (emi <= 0) return null;
  const i = annualRatePct / 12 / 100;
  if (i === 0) return Math.ceil(principal / emi);
  // EMI must at least cover the first month's interest or the loan never ends.
  if (emi <= principal * i) return null;
  const n = Math.log(emi / (emi - principal * i)) / Math.log(1 + i);
  // Nudge for float error so a clean 60-month loan does not round up to 61.
  return Math.ceil(n - 1e-9);
}

export function amortisationSchedule(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  emiOverride?: number,
): AmortisationRow[] {
  const i = annualRatePct / 12 / 100;
  const emi = emiOverride ?? emiFor(principal, annualRatePct, tenureMonths);
  const rows: AmortisationRow[] = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths && balance > 0.005; month++) {
    const interest = balance * i;
    // Last instalment absorbs rounding so the balance lands exactly on zero.
    const payment = Math.min(emi, balance + interest);
    const principalPaid = payment - interest;
    const closing = balance - principalPaid;
    rows.push({
      month,
      openingBalance: balance,
      emi: payment,
      interest,
      principal: principalPaid,
      closingBalance: closing,
    });
    balance = closing;
  }
  return rows;
}

export function totalInterest(rows: AmortisationRow[]): number {
  return rows.reduce((sum, r) => sum + r.interest, 0);
}

export interface PrepaymentResult {
  monthsOriginal: number;
  monthsAfter: number;
  monthsReduced: number;
  interestOriginal: number;
  interestAfter: number;
  interestSaved: number;
  /** Months from now to the new payoff. */
  newPayoffMonth: number;
  /** What the same money would be worth if invested instead. */
  counterfactual: {
    annualReturnPct: number;
    /** Value at the original payoff horizon. */
    futureValue: number;
    gain: number;
    /** True when investing beats prepaying — common on cheap education loans. */
    investingWins: boolean;
  };
}

/**
 * Lump-sum prepayment with tenure reduction (EMI held constant), plus the
 * counterfactual: the same rupees invested instead.
 */
export function prepaymentImpact(params: {
  outstanding: number;
  annualRatePct: number;
  emi: number;
  extraPayment: number;
  /** Rate the same money would earn if invested. Default 8%. */
  investmentReturnPct?: number;
}): PrepaymentResult {
  const { outstanding, annualRatePct, emi, extraPayment } = params;
  const investmentReturnPct = params.investmentReturnPct ?? 8;

  const nOriginal = tenureFor(outstanding, annualRatePct, emi) ?? 0;
  const original = amortisationSchedule(
    outstanding,
    annualRatePct,
    nOriginal,
    emi,
  );

  const reduced = Math.max(0, outstanding - extraPayment);
  const nAfter = reduced === 0 ? 0 : (tenureFor(reduced, annualRatePct, emi) ?? 0);
  const after = amortisationSchedule(reduced, annualRatePct, nAfter, emi);

  const interestOriginal = totalInterest(original);
  const interestAfter = totalInterest(after);

  const years = nOriginal / 12;
  const futureValue =
    extraPayment * Math.pow(1 + investmentReturnPct / 100, years);
  const gain = futureValue - extraPayment;

  return {
    monthsOriginal: original.length,
    monthsAfter: after.length,
    monthsReduced: original.length - after.length,
    interestOriginal,
    interestAfter,
    interestSaved: interestOriginal - interestAfter,
    newPayoffMonth: after.length,
    counterfactual: {
      annualReturnPct: investmentReturnPct,
      futureValue,
      gain,
      investingWins: gain > interestOriginal - interestAfter,
    },
  };
}

export interface NoCostEmiCost {
  stickerPrice: number;
  /** Discount you give up by not paying cash. */
  discountForgone: number;
  processingFee: number;
  /** Interest the bank books even though it is "waived". */
  notionalInterest: number;
  gstOnInterest: number;
  trueCost: number;
  /** trueCost - stickerPrice. */
  hiddenCost: number;
  monthlyEmi: number;
}

/**
 * "No-cost" EMI almost always means the interest is baked into the price as a
 * forgone cash discount, plus GST on the notional interest the bank still books.
 *
 *   True cost = sticker - cash discount forgone + processing fee
 *               + GST on notional interest
 */
export function noCostEmiTrueCost(params: {
  stickerPrice: number;
  /** Discount available if you paid cash instead. Default 0. */
  cashDiscount?: number;
  processingFee?: number;
  tenureMonths: number;
  /** Rate the bank uses to compute the "waived" interest. Default 15%. */
  notionalRatePct?: number;
  /** GST on the interest component. Default 18%. */
  gstPct?: number;
}): NoCostEmiCost {
  const {
    stickerPrice,
    tenureMonths,
    cashDiscount = 0,
    processingFee = 0,
    notionalRatePct = 15,
    gstPct = 18,
  } = params;

  const notionalEmi = emiFor(stickerPrice, notionalRatePct, tenureMonths);
  const notionalInterest = notionalEmi * tenureMonths - stickerPrice;
  const gstOnInterest = (notionalInterest * gstPct) / 100;

  const trueCost =
    stickerPrice - cashDiscount + processingFee + gstOnInterest;

  return {
    stickerPrice,
    discountForgone: cashDiscount,
    processingFee,
    notionalInterest,
    gstOnInterest,
    trueCost,
    hiddenCost: trueCost - stickerPrice,
    monthlyEmi: tenureMonths > 0 ? stickerPrice / tenureMonths : 0,
  };
}
