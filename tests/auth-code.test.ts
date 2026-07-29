import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  CODE_LENGTH,
  DISPLAY_LENGTH,
  format,
  formatPartial,
  isComplete,
  normalise,
} from '@/lib/auth-code';

describe('the alphabet', () => {
  it('leaves out every character people confuse', () => {
    for (const excluded of ['I', 'L', 'O', 'U']) {
      expect(ALPHABET).not.toContain(excluded);
    }
  });

  it('keeps the characters those mistakes fold into', () => {
    // `normalise` maps O to 0 and I/L to 1, so both have to be typeable.
    expect(ALPHABET).toContain('0');
    expect(ALPHABET).toContain('1');
  });

  it('is 32 characters, so a code is 60 bits', () => {
    expect(ALPHABET).toHaveLength(32);
    expect(new Set(ALPHABET).size).toBe(32);
  });
});

describe('normalise', () => {
  it('takes a code exactly as the email prints it', () => {
    expect(normalise('A1B2-C3D4-E5F6')).toBe('A1B2C3D4E5F6');
  });

  it('takes it without the dashes', () => {
    expect(normalise('A1B2C3D4E5F6')).toBe('A1B2C3D4E5F6');
  });

  it('takes it in lowercase', () => {
    expect(normalise('a1b2-c3d4-e5f6')).toBe('A1B2C3D4E5F6');
  });

  it('folds the letters people type for 0 and 1', () => {
    // Nothing minted can contain O, I or L, so these are always mistakes.
    expect(normalise('OIL')).toBe('011');
    expect(normalise('oil')).toBe('011');
  });

  it('drops spaces, dashes and anything else pasted in', () => {
    expect(normalise('  A1B2 C3D4\tE5F6\n')).toBe('A1B2C3D4E5F6');
    expect(normalise('A1B2—C3D4_E5F6')).toBe('A1B2C3D4E5F6');
  });

  it('is stable: normalising twice changes nothing', () => {
    const once = normalise('a1b2-c3d4-e5f6');
    expect(normalise(once)).toBe(once);
  });
});

describe('format', () => {
  it('groups twelve characters into three fours', () => {
    expect(format('A1B2C3D4E5F6')).toBe('A1B2-C3D4-E5F6');
  });

  it('round-trips with normalise', () => {
    expect(normalise(format('A1B2C3D4E5F6'))).toBe('A1B2C3D4E5F6');
  });

  it('agrees with the field length the input is capped at', () => {
    expect(format('A1B2C3D4E5F6')).toHaveLength(DISPLAY_LENGTH);
    expect(DISPLAY_LENGTH).toBe(CODE_LENGTH + 2);
  });
});

describe('formatPartial', () => {
  it('adds each dash as the group before it fills', () => {
    expect(formatPartial('A1B')).toBe('A1B');
    expect(formatPartial('A1B2')).toBe('A1B2');
    expect(formatPartial('A1B2C')).toBe('A1B2-C');
    expect(formatPartial('A1B2C3D4')).toBe('A1B2-C3D4');
    expect(formatPartial('A1B2C3D4E')).toBe('A1B2-C3D4-E');
  });

  it('does not fight someone typing the dashes themselves', () => {
    expect(formatPartial('A1B2-')).toBe('A1B2');
    expect(formatPartial('A1B2-C')).toBe('A1B2-C');
  });

  it('refuses more than a code is long', () => {
    expect(formatPartial('A1B2C3D4E5F6XYZ')).toBe('A1B2-C3D4-E5F6');
  });

  it('is stable, so re-rendering the field does not shuffle it', () => {
    const once = formatPartial('a1b2c3d4e5f6');
    expect(formatPartial(once)).toBe(once);
  });
});

describe('isComplete', () => {
  it('is true only at a full twelve characters', () => {
    expect(isComplete('A1B2-C3D4-E5F')).toBe(false);
    expect(isComplete('A1B2-C3D4-E5F6')).toBe(true);
    expect(isComplete('a1b2c3d4e5f6')).toBe(true);
  });

  it('does not count the dashes toward the twelve', () => {
    expect(isComplete('----A1B2C3D4----')).toBe(false);
  });
});
