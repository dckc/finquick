export const freezeProps = <T extends Record<string, unknown>>(
  obj: T,
): Readonly<T> => {
  for (const value of Object.values(obj)) {
    if (typeof value === 'function') {
      Object.freeze(value);
    }
  }
  return Object.freeze(obj);
};

export const Nat = (specimen: bigint) => {
  if (typeof specimen !== 'bigint') {
    throw new Error('amount must be bigint');
  }
  if (specimen < 0n) {
    throw new Error('amount must be non-negative');
  }
  return specimen;
};
