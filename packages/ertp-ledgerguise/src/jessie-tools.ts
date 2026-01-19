export const freezeProps = <T extends Record<PropertyKey, unknown>>(
  obj: T,
): Readonly<T> => {
  for (const key of Reflect.ownKeys(obj)) {
    const value = (obj as Record<PropertyKey, unknown>)[key];
    if (typeof value === 'function') {
      Object.freeze(value);
    }
  }
  return Object.freeze(obj);
};

export type Zone = {
  exo: <T extends Record<PropertyKey, unknown>>(
    interfaceName: string,
    methods: T,
  ) => Readonly<T>;
};

export const defaultZone: Zone = {
  exo: (_interfaceName, methods) => freezeProps(methods),
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
