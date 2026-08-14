export const MIN_PASSPHRASE_LENGTH = 12;

export interface PassphraseStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
}

const CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/] as const;

const POOL_SIZE = [26, 26, 10, 33];

function estimateBits(value: string): number {
  const pool = CLASSES.reduce(
    (total, pattern, i) => (pattern.test(value) ? total + POOL_SIZE[i] : total),
    0,
  );
  if (pool === 0) return 0;

  const bits = value.length * Math.log2(pool);
  const unique = new Set(value).size;
  const repetition = unique / value.length;
  return bits * Math.min(1, 0.4 + repetition);
}

export function ratePassphrase(value: string): PassphraseStrength {
  if (!value) {
    return { score: 0, label: 'Empty', hint: 'Enter a passphrase.' };
  }
  if (value.length < MIN_PASSPHRASE_LENGTH) {
    return {
      score: 0,
      label: 'Too short',
      hint: `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    };
  }

  const bits = estimateBits(value);
  if (bits < 50) {
    return {
      score: 1,
      label: 'Weak',
      hint: 'A determined attacker with this file could crack it. Add length.',
    };
  }
  if (bits < 70) {
    return {
      score: 2,
      label: 'Fair',
      hint: 'Acceptable, but a longer passphrase is meaningfully stronger.',
    };
  }
  if (bits < 90) {
    return {
      score: 3,
      label: 'Strong',
      hint: 'Good. Store it somewhere you will still have it later.',
    };
  }
  return {
    score: 4,
    label: 'Very strong',
    hint: 'Store it somewhere you will still have it later.',
  };
}
