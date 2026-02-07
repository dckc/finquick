const extractToken = (webkey) => {
  const hashIndex = webkey.indexOf('#s=');
  if (hashIndex >= 0) return webkey.slice(hashIndex + 3);
  const queryIndex = webkey.indexOf('?s=');
  if (queryIndex >= 0) return webkey.slice(queryIndex + 3);
  return webkey;
};

const makeWebkey = (origin, token) => `${origin}/ocaps/#s=${token}`;

const makeWebkeyPayload = (origin, depiction) => {
  if (depiction && typeof depiction === 'object' && '@' in depiction) {
    const ref = String(depiction['@']);
    return { '@': makeWebkey(origin, extractToken(ref)) };
  }
  return { '=': depiction };
};

export { extractToken, makeWebkey, makeWebkeyPayload };
