/**
 * @typedef {{
 *   lookup: (what: Record<string, string>) => Promise<string>,
 *   makePassKey: (what: Record<string, string>) => PassKey,
 * }} SecretTool
 *
 * @typedef {{
 *   subKey: (subProps: Record<string, string>) => PassKey;
 *   properties: () => Record<string, string>;
 *   get: () => Promise<string>;
 * }} PassKey
 */
/**
 * @param {typeof import('child_process').spawn} spawn
 * @returns {SecretTool}
 */
export function makeSecretTool(spawn: typeof import('child_process').spawn): SecretTool;
/**
 * @param {string} arg1
 * @param {string[]} args
 */
export function args2props(arg1: string, args: string[]): any;
export function make(): SecretTool;
export type SecretTool = {
    lookup: (what: Record<string, string>) => Promise<string>;
    makePassKey: (what: Record<string, string>) => PassKey;
};
export type PassKey = {
    subKey: (subProps: Record<string, string>) => PassKey;
    properties: () => Record<string, string>;
    get: () => Promise<string>;
};
