/**
 * CSV writing, to RFC 4180.
 *
 * Hand-rolled rather than pulled in: the whole job is quoting, and the rules
 * that matter are the ones people hit — a note containing a comma, a quote, or
 * a newline pasted from somewhere else. Getting those wrong corrupts a file
 * silently, which is worse than not offering the export.
 */

/** Quotes a single value if it needs it, and doubles any quotes inside. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Rows to a CSV document, CRLF line endings as the spec asks. */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * A leading byte-order mark. Excel assumes the system codepage without it and
 * turns ₹ into mojibake, which is the first thing anyone notices.
 */
export const BOM = '﻿';
