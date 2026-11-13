// Types for src/*.js. Apps Script files share one global scope, so
// these are global too. Nothing here is pushed: clasp pushes src/ only.

/**
 * The part of the Gmail advanced service a mail query uses: reading.
 * (@types/google-apps-script has no types for advanced services.)
 */
interface GmailReader {
  Users: {
    Threads: {
      list(
        userId: 'me',
        opts: { q: string; maxResults: number },
      ): { threads?: { id: string }[]; nextPageToken?: string };
      get(
        userId: 'me',
        id: string,
        opts: { format: 'metadata'; metadataHeaders: string[] },
      ): GmailThread;
    };
    Messages: { get(userId: 'me', id: string, opts: { format: 'raw' }): GmailMessage };
  };
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  payload?: { headers?: GmailHeader[] };
  /** with format: 'raw'; the advanced service gives bytes */
  raw?: string | number[];
}

interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

/**
 * The Webkeys sheet: the capability table, one row per webkey. A
 * Spreadsheet.Sheet is one; its getValues() says any[][], but a cell
 * could hold anything, so: unknown.
 */
interface WebkeysSheet {
  getDataRange(): { getValues(): unknown[][] };
  getRange(row: number, column: number): { setValue(value: string): unknown };
}

/** The Gmail advanced service, as appsscript.json enables it: only what we read. */
declare const Gmail: GmailReader;
