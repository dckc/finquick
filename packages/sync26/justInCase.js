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

  console.log('adding viewer to folder', { emailAddress, folder: folder.getName(), folderId });
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
  const emailAddress = detail.viewersToAdd; // assume just 1 for initial test
  shareFolder({ folderId, emailAddress });
}

function getFolderId(range) {
  const url = range?.getRichTextValue()?.getLinkUrl();
  if (!url) return undefined;
  const folderId = url.split('/').at(-1);
  return { url, folderId };
}

function shareJustInCase(io = {}) {
  const {
    sheetName = 'Triggers',
    doc = SpreadsheetApp.getActive(),
    sheet = doc.getSheetByName(sheetName),
    clock = (() => new Date()),
    getFolderById = id => DriveApp.getFolderById(id),
  } = io;

  deleteAllTriggers(); // XXX pass ScriptApp.getProjectTriggers

  const hd = getHeading(sheet);
  const getCell = colName => {
    const colNum = hd.indexOf(colName) + 1;
    return row => sheet.getRange(row, colNum, 1, 1);
  }
  let firstDeadline;
  for (let row = sheet.getLastRow(); row > 1 ; row -= 1) {
    const detail = getRowRecord(sheet, row, hd);

    const { folderId } = getFolderId(getCell('folder')(row));
    if (!folderId) continue;
    const folder = getFolderById(folderId);

    getCell('viewers')(row).setValue(folder.getViewers().map(u => u.getEmail()).join(', '));

    const note = detail.status ? (clock() >= detail.deadline ? 'Ready' : 'Pending') : 'Disabled';
    console.log({ note, ...detail });
    // TODO: consider a row proxy so we can do rowRecord.note = 'Off';
    getCell('note')(row).setValue(note);
    if (note !== 'Pending')  continue;

    const { deadline } = detail;
    if (firstDeadline === undefined || deadline.getTime() < firstDeadline.getTime()) {
      firstDeadline = deadline;
      // TODO: capture row; highlight it?
    }
  }
  if (!firstDeadline) return;

  const { newTrigger = (...args) => ScriptApp.newTrigger(...args) } = io;
  const trigger = newTrigger('onSharingTrigger')
    .timeBased().at(firstDeadline)
    .create();
  const triggerId = trigger.getUniqueId()
  console.log('created trigger', { triggerId, at: firstDeadline });
}

function onSharingTrigger(io = {}) {
  const {
    sheetName = 'Triggers',
    doc = SpreadsheetApp.getActive(),
    sheet = doc.getSheetByName(sheetName),
    clock = (() => new Date()),
    current = clock(),
    getFolderById = id => DriveApp.getFolderById(id),
  } = io;

  console.log('onSharingTrigger', current);

  const hd = getHeading(sheet);
  const getCell = colName => {
    const colNum = hd.indexOf(colName) + 1;
    return row => sheet.getRange(row, colNum, 1, 1);
  }
  for (let row = sheet.getLastRow(); row > 1 ; row -= 1) {
    const detail = getRowRecord(sheet, row, hd);

    const { folderId } = getFolderId(getCell('folder')(row));
    if (!folderId) continue;
    const folder = getFolderById(folderId);

    const note = detail.status ? (current >= detail.deadline ? 'Ready' : 'Pending') : 'Disabled';
    console.log({ note, ...detail });
    getCell('note')(row).setValue(note);
    if (note !== 'Ready')  continue;

    const viewersToAdd = detail.viewersToAdd.split(',').map(addr => addr.trim());
    for (const emailAddress of viewersToAdd) {
      shareFolder({ folder, emailAddress });
    }
    const viewersPost = [...new Set([... folder.getViewers().map(u => u.getEmail()), ...viewersToAdd])]
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
