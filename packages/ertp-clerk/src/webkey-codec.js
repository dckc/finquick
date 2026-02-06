const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isBigIntRecord = (value) => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  if (keys[0] !== '+' && keys[0] !== '-') return false;
  const entry = value[keys[0]];
  return typeof entry === 'string';
};

const encodeBigInt = (value) => {
  if (value < 0n) return { '-': (-value).toString() };
  return { '+': value.toString() };
};

const decodeBigIntRecord = (value) => {
  if ('+' in value) return BigInt(value['+']);
  return -BigInt(value['-']);
};

const isWebkeyRef = (value) => isRecord(value) && '@' in value && typeof value['@'] === 'string';

const encodeClientValue = (value, options = {}) => {
  const { getProxyRef } = options;
  if (typeof value === 'bigint') return encodeBigInt(value);
  const proxyRef = getProxyRef ? getProxyRef(value) : undefined;
  if (proxyRef) return { '@': proxyRef };
  if (!getProxyRef && value && typeof value === 'object' && value.isProxy && value.webkey) {
    return { '@': value.webkey };
  }
  if (Array.isArray(value)) return value.map((entry) => encodeClientValue(entry, options));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, encodeClientValue(v, options)]),
    );
  }
  return value;
};

const decodeClientValue = (value, keyToProxy) => {
  if (isBigIntRecord(value)) return decodeBigIntRecord(value);
  if (isWebkeyRef(value)) return keyToProxy(value['@']);
  if (Array.isArray(value)) return value.map((entry) => decodeClientValue(entry, keyToProxy));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeClientValue(v, keyToProxy)]));
  }
  return value;
};

export {
  isRecord,
  isBigIntRecord,
  encodeBigInt,
  decodeBigIntRecord,
  isWebkeyRef,
  encodeClientValue,
  decodeClientValue,
};
