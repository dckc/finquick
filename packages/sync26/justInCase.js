/**
 * @file Share a folder if owner is not available to keep it confidential.
 * 
 * [Installable Triggers | Apps Script |  Google for Developers](https://developers.google.com/apps-script/guides/triggers/installable)
 * 
 * see also [Dead man's switch](https://en.wikipedia.org/wiki/Dead_man%27s_switch)
 * 
 * TODO: rework as CALENDAR trigger?
 */

function shareFolder(io = {}) {
  const {
    folderId,
    folder = DriveApp.getFolderById(folderId),
    emailAddress,
  } = io;

  console.log('adding viewer to folder', { emailAddress, folderId });
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
  const folderId = getFolderId(sheet.getRange(row, folderCol));
  const emailAddress = detail.viewersToAdd; // assume just 1 for initial test
  shareFolder({ folderId, emailAddress });
}

function getFolderId(range) {
  const url = range?.getRichTextValue()?.getLinkUrl();
  if (!url) return undefined;
  return url.split('/').at(-1);
}

function shareJustInCase(io = {}) {
  const {
    doc = SpreadsheetApp.getActive(),
    sheetName = 'Triggers',
    sheet = doc.getSheetByName(sheetName),
    clock = (() => new Date()),
  } = io;

  const hd = getHeading(sheet);
  const folderCol = hd.indexOf('folder') + 1;
  const noteCol = hd.indexOf('note') + 1;
  for (let row = sheet.getLastRow(); row > 1 ; row -= 1) {
    const detail = getRowRecord(sheet, row, hd);

    const note = detail.status ? (clock() >= detail.deadline ? 'Done' : true) : false;
    // TODO: consider a row proxy so we can do rowRecord.note = 'Off';
    sheet.getRange(row, noteCol).setValue(note);
    if (note !== true)  continue;

    const id = getFolderId(sheet.getRange(row, folderCol, 1, 1));
    if (!id) continue;
    console.log({ detail, url, id });
  }
}

function COUNT_DOWN(deadline, status, io = {}) {
  if (!status) return 'Off';
  const { clock = (() => new Date()) } = io;
  if (clock() >= deadline) return 'Done';

  const { newTrigger = (...args) => ScriptApp.newTrigger(...args) } = io;
  const trigger = newTrigger('shareJustInCase')
    .timeBased().at(deadline)
    .create();
  console.log(trigger.getUniqueId(), trigger);
}

function count_down_test({
  clock = (() => new Date()),
  deadline = new Date(clock().getTime() + 360000),
  status = true,
} = {}) {
  COUNT_DOWN(deadline, status, { clock })
}

function deleteAllTriggers() {
  // Loop over all triggers.
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    console.log('deleting trigger', trigger.getUniqueId());
    ScriptApp.deleteTrigger(trigger);
  }
}
