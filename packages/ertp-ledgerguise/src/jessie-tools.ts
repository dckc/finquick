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
