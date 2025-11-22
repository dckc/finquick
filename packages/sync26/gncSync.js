const sheetsConfig = {
  plaid: {
    name: 'Transactions (2)',
    cols: {
      gncIdTarget: 'tx_guid',
    },
  },
  gnucash: {
    name: 'GnuCash_Uncat',
    cols: {
      plaidIdTarget: 'Transaction ID',
    },
  },
  accounts: {
    name: 'Accounts',
  },
};

/**
 * @typedef {{
 * Date: Date,
 * Amount: number,
 * 'Account #': string,
 * tx_guid: string,
 * 'Transaction ID': string,
 * Account: string,
 * }} PlaidTransactionRecord
 */

/**
 * @typedef {{
 * date: Date,
 * account: string,
 * amount: number,
 * tx_guid: string,
 * plaid_id?: string,
 * }} GnuCashTransactionRecord
 */

/**
 * @typedef {{
 * code: string,
 * Account: string,
 * }} AccountRecord
 */

/**
 * @typedef {{
 * gncRecord: GnuCashTransactionRecord,
 * plaidMatch: PlaidTransactionRecord,
 * gncIndex: number, // 0-based index in the recordsToProcess (first 10) array
 * plaidIndex: number, // 0-based index in the full plaidRecords array
 * }} MatchResult
 */

/**
 * Main controller function. Fetches data, orchestrates the matching process, and writes back the IDs.
 *
 * @param {object} io Injected dependencies for testability/I/O.
 */
const SyncGnuCashPlaidTxns = (_nonce, io = {}) => {
  const {
    doc = SpreadsheetApp.getActive(),
    activeRange = SpreadsheetApp.getActiveRange(),
    gncSheet = doc.getSheetByName(sheetsConfig.gnucash.name),
    plaidSheet = doc.getSheetByName(sheetsConfig.plaid.name),
    accountsSheet = doc.getSheetByName(sheetsConfig.accounts.name),
  } = io;

  // Get Sheets and All Records
  if (!gncSheet || !plaidSheet || !accountsSheet) {
    throw Error('Required sheets not found. Check sheet names in config.');
  }
  const { records: plaidRecords } = getSheetRecords(plaidSheet, 2);
  const { records: accountRecords } = getSheetRecords(accountsSheet, 2);
  const { records: gncRecords } = getSheetRecords(gncSheet);

  /** @type {Map<string, string>} */
  const codeToPlaidAcctNameMap = new Map(
    accountRecords
      .map(record => {
        /** @type {AccountRecord} */
        const aRecord = /** @type {AccountRecord} */ (record);
        return [String(aRecord.code), aRecord.Account];
      })
      .filter(([, plaidAcctName]) => plaidAcctName),
  );

  // 1-indexed, including header
  const [lo, hi] = [activeRange.getRow(), activeRange.getLastRow()];
  const recordsToProcess = gncRecords.slice(lo - 2, hi - 1);

  const matches = findTransactionMatches(
    recordsToProcess,
    plaidRecords,
    codeToPlaidAcctNameMap,
  );

  // Write Back Results
  const gncPlaidIdCol = getColumnNumber(
    gncSheet,
    sheetsConfig.gnucash.cols.plaidIdTarget,
  );
  const plaidGncIdCol = getColumnNumber(
    plaidSheet,
    sheetsConfig.plaid.cols.gncIdTarget,
  );
  for (const match of matches) {
    // Calculate 1-based row numbers, based on activeRange
    const gncRowNum = match.gncIndex + lo;
    const plaidRowNum = match.plaidIndex + 2;

    const plaidTxId = match.plaidMatch['Transaction ID'];

    gncSheet.getRange(gncRowNum, gncPlaidIdCol).setValue(plaidTxId);
    plaidSheet
      .getRange(plaidRowNum, plaidGncIdCol)
      .setValue(match.gncRecord.tx_guid);
  }

  // Final Status Report
  console.log(
    `Successfully synced ${matches.length} out of ${recordsToProcess.length}`,
  );
};

const SyncGnuCashPlaidTxnsTest = (nonce, io = {}) => {
  const {
    doc = SpreadsheetApp.getActive(),
    gncSheet = doc.getSheetByName(sheetsConfig.gnucash.name),
    activeRange = gncSheet.getRange('A3:G5'),
  } = io;
  return SyncGnuCashPlaidTxns(nonce, { ...io, doc, gncSheet, activeRange });
};

/**
 * Checks if two Date objects are within a specified number of days of each other.
 *
 * @param {Date} date1
 * @param {Date} date2
 * @param {number} maxDays - The maximum allowable difference in days (e.g., 2 for +/- 2 days).
 */
const fuzzyDateMatch = (date1, date2, maxDays) => {
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  return diffTime <= maxDays * DAY;
};

/**
 * Core matching engine. Finds corresponding Plaid transactions for a list of GnuCash transactions.
 *
 * @param {GnuCashTransactionRecord[]} gncRecordsToProcess - The GnuCash records to iterate over.
 * @param {PlaidTransactionRecord[]} allPlaidRecords - All Plaid records to search against.
 * @param {Map<string, string>} codeToPlaidAcctNameMap - Map from GnuCash code to Plaid Account Name.
 * @returns {MatchResult[]} An array of objects containing the matched records and their original indices.
 */
const findTransactionMatches = (
  gncRecordsToProcess,
  allPlaidRecords,
  codeToPlaidAcctNameMap,
) => {
  /** @type {MatchResult[]} */
  const matches = [];

  for (let gncIndex = 0; gncIndex < gncRecordsToProcess.length; gncIndex++) {
    const gncRecord = gncRecordsToProcess[gncIndex];
    if (gncRecord['Transaction Id']) continue; // already matched

    const requiredPlaidAcctName = codeToPlaidAcctNameMap.get(
      String(gncRecord.account),
    );
    if (!requiredPlaidAcctName) continue;

    const foundMatch = allPlaidRecords.find(plaidRecord => {
      if (plaidRecord.tx_guid) return false; // already matched
      if (plaidRecord.Account !== requiredPlaidAcctName) return false;
      if (gncRecord.amount !== -plaidRecord.Amount) return false;
      return fuzzyDateMatch(plaidRecord.Date, gncRecord.date, 2.67);
    });

    // Record Match and Indices
    if (foundMatch) {
      const plaidIndex = allPlaidRecords.indexOf(foundMatch);

      matches.push({
        gncRecord,
        plaidMatch: foundMatch,
        gncIndex,
        plaidIndex,
      });
    }
  }

  return matches;
};
