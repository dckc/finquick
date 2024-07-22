/**
 * @file Share a folder if owner is not available to keep it confidential.
 * aka make a [Dead man's switch](https://en.wikipedia.org/wiki/Dead_man%27s_switch).
 *
 * Usage:
 *  - make a menu item for shareJustInCase.
 *  - make a Triggers sheet with the following columns:
 *
 * @typedef {{
 *   status: boolean;
 *   deadline: Date;
 *   folder: GoogleAppsScript.Drive.Folder; // rich text linked to a GDrive folder
 *   viewersToAdd: string; // comma-separated email addresses
 *   viewers?: string;
 *   note?: 'Disabled' | 'Ready' | 'Pending' | 'Triggered';
 *   triggeredAt?: Date;
 * }} FolderTriggerDetail
 *
 * requires {@link sheetTools.js}
 */
// @ts-check

// import { getHeading, getRowRecord } from './sheetTools.js';

/**
 * @template T
 * @param {T | null | undefined} x
 * @returns T
 */
const NonNullish = x => {
  if (!x) throw Error('null / undefined not expected');
  return x;
};

/**
 * Add an emailAddress to the viewers of a folder.
 *
 * @param {{ emailAddress: string } & (HasFolder | HasFolderId)} io
 *
 * @typedef {object} HasFolder
 * @property {GoogleAppsScript.Drive.Folder} folder
 * @property {string} [folderId] ignored
 *
 * @typedef {object} HasFolderId
 * @property {string} folderId only used if folder is not present
 * @property {GoogleAppsScript.Drive.Folder} [folder]
 */
function shareFolder(io) {
  const {
    folderId,
    folder = DriveApp.getFolderById(NonNullish(folderId)),
    emailAddress, // TODO: default to fail
  } = io;

  console.log('adding viewer to folder', {
    emailAddress,
    folder: folder.getName(),
    folderId,
  });
  folder.addViewer(emailAddress);
}

function shareFolderTest(io = {}) {
  const {
    doc = SpreadsheetApp.getActive(),
    sheetName = 'Triggers',
    sheet = doc.getSheetByName(sheetName),
    row = 2,
  } = io;

  const hd = getHeading(sheet);
  const detail = getRowRecord(sheet, row, hd);
  const folderCol = hd.indexOf('folder') + 1;
  const { folderId } = getFolderId(sheet.getRange(row, folderCol));
  if (!folderId) throw Error('missing folder');
  const emailAddress = detail.viewersToAdd; // assume just 1 for initial test
  shareFolder({ folderId, emailAddress });
}

/** @param {GoogleAppsScript.Spreadsheet.Range} range */
function getFolderId(range) {
  const url = range?.getRichTextValue()?.getLinkUrl();
  if (!url) return {};
  const folderId = url.split('/').at(-1);
  return { url, folderId };
}

/**
 * Evaluate folder deadlines and, if any are pending, create a
 * [trigger](https://developers.google.com/apps-script/guides/triggers/installable)
 * to run `onSharingTrigger`.
 *
 * @param {object} io
 * @param {string} [io.sheetName]
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [io.doc]
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [io.sheet]
 * @param {() => Date} [io.clock]
 * @param {typeof DriveApp.getFolderById} [io.getFolderById]
 * @param {typeof ScriptApp.newTrigger} [io.newTrigger]
 */
function shareJustInCase(io = {}) {
  const {
    sheetName = 'Triggers',
    doc = SpreadsheetApp.getActive(),
    sheet = NonNullish(doc.getSheetByName(sheetName)),
    clock = () => new Date(),
    getFolderById = id => DriveApp.getFolderById(id),
  } = io;

  deleteAllTriggers(); // XXX pass ScriptApp.getProjectTriggers

  const hd = getHeading(sheet);
  /** @param {string} colName */
  const getCell = colName => {
    const colNum = hd.indexOf(colName) + 1;
    /** @param {number} row */
    return row => sheet.getRange(row, colNum, 1, 1);
  };
  /** @type {Date | undefined} */
  let firstDeadline;
  for (let row = sheet.getLastRow(); row > 1; row -= 1) {
    const detail = /** @type {FolderTriggerDetail} */ (
      getRowRecord(sheet, row, hd)
    );

    const { folderId } = getFolderId(getCell('folder')(row));
    if (!folderId) continue;
    const folder = getFolderById(folderId);

    getCell('viewers')(row).setValue(
      folder
        .getViewers()
        .map(u => u.getEmail())
        .join(', '),
    );

    const note = detail.status
      ? clock() >= detail.deadline
        ? 'Ready'
        : 'Pending'
      : 'Disabled';
    console.log({ ...detail, note });
    // TODO: consider a row proxy so we can do rowRecord.note = 'Off';
    getCell('note')(row).setValue(note);
    if (note !== 'Pending') continue;

    const { deadline } = detail;
    if (
      firstDeadline === undefined ||
      deadline.getTime() < firstDeadline.getTime()
    ) {
      firstDeadline = deadline;
      // TODO: capture row; highlight it?
    }
  }
  if (!firstDeadline) return;

  const { newTrigger = (...args) => ScriptApp.newTrigger(...args) } = io;
  const trigger = newTrigger('onSharingTrigger')
    .timeBased()
    .at(firstDeadline)
    .create();
  const triggerId = trigger.getUniqueId();
  console.log('created trigger', { triggerId, at: firstDeadline });
}

function onSharingTrigger(io = {}) {
  const {
    sheetName = 'Triggers',
    doc = SpreadsheetApp.getActive(),
    sheet = doc.getSheetByName(sheetName),
    clock = () => new Date(),
    current = clock(),
    getFolderById = id => DriveApp.getFolderById(id),
  } = io;

  console.log('onSharingTrigger', current);

  const hd = getHeading(sheet);
  const getCell = colName => {
    const colNum = hd.indexOf(colName) + 1;
    return row => sheet.getRange(row, colNum, 1, 1);
  };
  for (let row = sheet.getLastRow(); row > 1; row -= 1) {
    const detail = getRowRecord(sheet, row, hd);

    const { folderId } = getFolderId(getCell('folder')(row));
    if (!folderId) continue;
    const folder = getFolderById(folderId);

    const note = detail.status
      ? current >= detail.deadline
        ? 'Ready'
        : 'Pending'
      : 'Disabled';
    console.log({ note, ...detail });
    getCell('note')(row).setValue(note);
    if (note !== 'Ready') continue;

    const viewersToAdd = detail.viewersToAdd
      .split(',')
      .map(addr => addr.trim());
    for (const emailAddress of viewersToAdd) {
      shareFolder({ folder, emailAddress });
    }
    const viewersPost = [
      ...new Set([
        ...folder.getViewers().map(u => u.getEmail()),
        ...viewersToAdd,
      ]),
    ];
    getCell('viewers')(row).setValue(viewersPost.join(', '));
    getCell('note')(row).setValue(`Shared`);
    getCell('triggeredAt')(row).setValue(current);
  }
}

function deleteAllTriggers() {
  // Loop over all triggers.
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    console.log('deleting trigger', trigger.getUniqueId());
    ScriptApp.deleteTrigger(trigger);
  }
}
