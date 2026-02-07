import { encodeClientValue, decodeClientValue } from './webkey-codec.js';
import { extractToken } from './webkey-protocol.js';

const makeKeyToProxy = (apiUrl, { fetch }) => {
  const keyToProxy = (webkey, allegedInterface = 'Remotable') => {
    const post = async (method, ...args) => {
      const url = new URL(apiUrl);
      const token = extractToken(webkey);
      url.searchParams.set('s', token);
      url.searchParams.set('q', method);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(args.map(encodeClientValue)),
      });
      const data = await res.json();
      if ('=' in data) return decodeClientValue(data['='], keyToProxy);
      if ('@' in data) return keyToProxy(data['@']);
      if ('!' in data) throw new Error(data['!']);
      throw new Error('rpc error');
    };
    const target = { webkey, isProxy: true, post };
    Object.defineProperty(target, Symbol.toStringTag, {
      value: allegedInterface,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    return new Proxy(target, {
      get(innerTarget, prop) {
        if (prop in innerTarget) return innerTarget[prop];
        if (prop === 'then') return undefined;
        return (...args) => innerTarget.post(prop, ...args);
      },
    });
  };
  return keyToProxy;
};

const makeBootstrap = (baseHref, webkey, allegedInterface, { fetch }) =>
  makeKeyToProxy(new URL('/api', baseHref), { fetch })(webkey, allegedInterface);

const makeClient = (apiUrl, { fetch }) => {
  const keyToProxy = makeKeyToProxy(apiUrl, { fetch });
  return { keyToProxy };
};

export { makeClient, makeKeyToProxy, makeBootstrap };
