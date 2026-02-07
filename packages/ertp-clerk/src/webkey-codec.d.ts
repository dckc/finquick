export function isRecord(value: unknown): value is Record<string, unknown>;
export function isBigIntRecord(
  value: unknown,
): value is { '+': string } | { '-': string };
export function encodeBigInt(value: bigint): { '+': string } | { '-': string };
export function decodeBigIntRecord(
  value: { '+': string } | { '-': string },
): bigint;
export function isWebkeyRef(value: unknown): value is { '@': string };
export function encodeClientValue(
  value: unknown,
  options?: {
    getProxyRef?: (value: unknown) => string | undefined | null;
  },
): WireEncoding;
export function decodeClientValue(
  value: WireEncoding,
  keyToProxy: (webkey: string) => unknown,
): unknown;

export type WireEncodingRecord = { [key: string]: WireEncoding };

export type WireEncoding =
  | null
  | boolean
  | number
  | string
  | { '+': `${number}` }
  | { '-': `${number}` }
  | { '@': string }
  | {
      call: {
        receiver: WireEncoding;
        method: string | null;
        args: ReadonlyArray<WireEncoding>;
      };
    }
  | { get: { receiver: WireEncoding; key: string | number } }
  | ReadonlyArray<WireEncoding>
  | Readonly<WireEncodingRecord>;
