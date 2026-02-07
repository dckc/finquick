export function extractToken(webkey: string): string;
export function makeWebkey(origin: string, token: string): string;
export function makeWebkeyPayload(
  origin: string,
  depiction: unknown,
): { '@': string } | { '=': unknown };
