const Rules = {
  sheetName: 'Rules',
  txSheet: 'Transactions (2)',
};

const { entries, fromEntries } = Object;
function checkRule(tx, rule) {
  for (let [prop, expected] of entries(rule)) {
    if (expected === '') continue;
    let ok;
    switch (prop) {
      case 'part':
        continue;
      case 'Day of Month':
        ok = expected === tx.Date.getDate();
        break;
      default:
        if (typeof expected === 'string' && expected.includes('*')) {
          ok = globToRegexp(expected).test(tx[prop]);
          break;
        }
        ok = tx[prop] === expected;
        break;
    }
    if (!ok) {
      return false;
    }
  }
  return true;
}

function applyRulesToRange(doc, range) {
  const txSheet = doc.getSheetByName(Rules.txSheet);
  const txHd = getHeading(txSheet);
  const rules = getSheetRecords(doc.getSheetByName(Rules.sheetName));

  for (let rowIx = range.getRow(); rowIx <= range.getLastRow(); rowIx += 1) {
    const tx = getRowRecord(txSheet, rowIx, txHd);
    if (tx.Category > '') continue;

    const each = rules.records[Symbol.iterator]();
    for (const rule of each) {
      if (rule.part !== 'if') continue;
      if (checkRule(tx, rule)) {
        const { done, value } = each.next();
        if (done) throw Error('missing then');
        if (value.part !== 'then')
          throw Error(`expected then; got ${value.parts}`);
        const edits = fromEntries(
          entries(value).filter(([p, v]) => p !== 'part' && v !== ''),
        );
        console.log('match', { rowIx, edits });
        updateRecord(txSheet, txHd, rowIx, edits);
      }
    }
  }
}

function testApplyrules(row = 203) {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const range = doc.getSheetByName('Transactions (2)').getRange(row, 1);
  applyRulesToRange(doc, range);
}

function ApplyRules() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const sel = doc.getSelection().getActiveRange();
  if (!sel) return;
  applyRulesToRange(doc, sel);
}
