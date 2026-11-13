/**
 * @file Types for the toybox modules the tests and scripts use. toybox
 * ships JavaScript with JSDoc, which tsc doesn't read from node_modules;
 * these say what this package relies on.
 */

declare module '@vattr/toybox/src/kernel-client.js' {
  import type { WebSocket } from 'ws';
  /** A presence: a reference to an object in a vat, for E(). */
  type Remote = any;
  export type KernelClient = {
    createVat: (
      src: string,
      params?: Record<string, unknown>,
    ) => Promise<{ root: Remote; adminNode: Remote }>;
    vats: () => Promise<{ root: Remote; adminNode: Remote }[]>;
    makeDevice: (name: string) => Promise<Remote>;
    close: () => void;
  };
  export const connectKernel: (ws: WebSocket) => Promise<KernelClient>;
}

declare module '@vattr/toybox/src/workerd-process.js' {
  export const here: string;
  export const makeWorkerd: (io: {
    workerd: string;
    spawn: typeof import('node:child_process').spawn;
    rm: (path: string, opts: { force: boolean }) => Promise<void>;
    connect: typeof import('node:net').connect;
    createServer: typeof import('node:net').createServer;
    sleep: (ms: number) => Promise<void>;
    log?: (chunk: Buffer) => void;
  }) => {
    freePort: () => Promise<number>;
    startWorkerd: (
      config: string,
      args: string[],
      listening: import('node:net').NetConnectOpts,
      stale?: string[],
    ) => Promise<{ stop: () => Promise<unknown> }>;
  };
}

declare module '@vattr/toybox/test/toybox.js' {
  export const makeToyboxes: (io: {
    startWorkerd: ReturnType<
      typeof import('@vattr/toybox/src/workerd-process.js').makeWorkerd
    >['startWorkerd'];
    freePort: () => Promise<number>;
    mkdir: (path: string, opts: { recursive: boolean }) => Promise<unknown>;
  }) => {
    startToybox: (
      dir: string,
      opts?: { config?: string; boot?: string },
    ) => Promise<{
      server: { stop: () => Promise<unknown> };
      sock: string;
      port: number;
      appPort: number;
    }>;
  };
}

declare module '@vattr/toybox/test/git.js' {
  export const makeGit: (io: {
    run: (file: string, args: string[]) => Promise<{ stdout: string }>;
    cp: typeof import('node:fs/promises').cp;
    makeScratchDir: () => Promise<string>;
  }) => {
    makeRepo: (
      dir: string,
      under?: string,
      repo?: string,
    ) => Promise<{ repo: string; tree: string; listing: string }>;
  };
}
