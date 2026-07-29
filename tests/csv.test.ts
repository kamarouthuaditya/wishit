import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/csv';

describe('csvCell', () => {
  it('leaves ordinary values alone', () => {
    expect(csvCell('food')).toBe('food');
    expect(csvCell(1200)).toBe('1200');
    expect(csvCell(true)).toBe('true');
  });

  it('writes nothing for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes a value containing a comma', () => {
    expect(csvCell('Groceries, and petrol')).toBe('"Groceries, and petrol"');
  });

  it('doubles quotes inside a quoted value', () => {
    expect(csvCell('the "good" bakery')).toBe('"the ""good"" bakery"');
  });

  it('quotes a value containing a newline', () => {
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF', () => {
    const csv = toCsv([
      ['date', 'amount', 'note'],
      ['2026-07-04', 1200, 'Groceries'],
    ]);
    expect(csv).toBe('date,amount,note\r\n2026-07-04,1200,Groceries');
  });

  it('survives a note that would otherwise break the shape', () => {
    const csv = toCsv([
      ['date', 'note'],
      ['2026-07-04', 'Dinner, drinks, "the usual"'],
    ]);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-07-04,"Dinner, drinks, ""the usual"""');
  });

  it('handles an empty set', () => {
    expect(toCsv([])).toBe('');
  });
});
