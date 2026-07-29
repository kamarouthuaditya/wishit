import { describe, expect, it } from 'vitest';
import {
  amortisationSchedule,
  emiFor,
  noCostEmiTrueCost,
  prepaymentImpact,
  tenureFor,
  totalInterest,
} from '@/lib/engine';

describe('emiFor', () => {
  it('matches the standard formula', () => {
    // ₹5,00,000 at 10% for 60 months = ₹10,623.52
    expect(emiFor(5_00_000, 10, 60)).toBeCloseTo(10_623.52, 1);
  });

  it('falls back to straight-line at 0%', () => {
    expect(emiFor(29_400, 0, 6)).toBe(4_900);
  });

  it('round-trips through tenureFor', () => {
    const emi = emiFor(5_00_000, 10, 60);
    expect(tenureFor(5_00_000, 10, emi)).toBe(60);
  });

  it('returns null when the EMI never clears the interest', () => {
    expect(tenureFor(5_00_000, 12, 1_000)).toBeNull();
  });
});

describe('amortisationSchedule', () => {
  it('pays the loan down to zero and splits interest correctly', () => {
    const rows = amortisationSchedule(5_00_000, 10, 60);
    expect(rows).toHaveLength(60);
    expect(rows[0].interest).toBeCloseTo(4_166.67, 1);
    expect(rows.at(-1)!.closingBalance).toBeCloseTo(0, 2);
    // Interest paid falls every month as principal shrinks.
    expect(rows[0].interest).toBeGreaterThan(rows.at(-1)!.interest);
    expect(totalInterest(rows)).toBeCloseTo(60 * 10_623.52 - 5_00_000, 0);
  });
});

describe('prepaymentImpact', () => {
  it('cuts tenure and interest, and shows the investing counterfactual', () => {
    const result = prepaymentImpact({
      outstanding: 5_00_000,
      annualRatePct: 4, // cheap education loan
      emi: 12_000,
      extraPayment: 50_000,
      investmentReturnPct: 8,
    });

    expect(result.monthsAfter).toBeLessThan(result.monthsOriginal);
    expect(result.interestSaved).toBeGreaterThan(0);
    // Prepaying a 4% loan while the market pays 8% is the wrong call.
    expect(result.counterfactual.investingWins).toBe(true);
    expect(result.counterfactual.gain).toBeGreaterThan(result.interestSaved);
  });

  it('flips to prepay-wins on an expensive loan', () => {
    const result = prepaymentImpact({
      outstanding: 5_00_000,
      annualRatePct: 18, // credit card style
      emi: 15_000,
      extraPayment: 1_00_000,
      investmentReturnPct: 8,
    });
    expect(result.counterfactual.investingWins).toBe(false);
  });
});

describe('noCostEmiTrueCost', () => {
  it('prices in the forgone discount and the GST on notional interest', () => {
    const cost = noCostEmiTrueCost({
      stickerPrice: 29_400,
      cashDiscount: 0,
      processingFee: 199,
      tenureMonths: 6,
      notionalRatePct: 15,
      gstPct: 18,
    });

    expect(cost.notionalInterest).toBeGreaterThan(0);
    expect(cost.gstOnInterest).toBeCloseTo(cost.notionalInterest * 0.18, 2);
    // "No cost" is never zero cost.
    expect(cost.trueCost).toBeGreaterThan(cost.stickerPrice);
    expect(cost.hiddenCost).toBeCloseTo(199 + cost.gstOnInterest, 2);
    expect(cost.monthlyEmi).toBe(4_900);
  });

  it('counts a forgone cash discount as real cost', () => {
    const withDiscount = noCostEmiTrueCost({
      stickerPrice: 1_00_000,
      cashDiscount: 5_000,
      tenureMonths: 12,
    });
    const without = noCostEmiTrueCost({
      stickerPrice: 1_00_000,
      cashDiscount: 0,
      tenureMonths: 12,
    });
    expect(without.trueCost - withDiscount.trueCost).toBe(5_000);
  });
});
