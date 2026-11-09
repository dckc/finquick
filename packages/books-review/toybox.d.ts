/**
 * @file Types for the toybox modules the tests and scripts use. toybox
 * ships JavaScript with JSDoc, which tsc doesn't read from node_modules;
 * these say what this package relies on.
 */

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
