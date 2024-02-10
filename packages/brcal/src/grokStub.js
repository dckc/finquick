/**
 * @file grok pay stub
 *
 * Usage:
 *   1. pdftotext -layout stub.pdf stub.txt
 *   2. node grokStub.js <stub.txt >stub.html
 *   3. copy/paste result into spreadsheet
 *   4. tidy it up just a bit
 */
// @ts-check

const { entries } = Object;

const zip = (xs, ys) => xs.map((x, ix) => [x, ys[ix]]);

const sum = xs => xs.reduce((acc, x) => acc + x, 0);

const read = async stream => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const parse = {
  across: (lines, todo = 1) => {
    const records = [];
    for (const line of lines) {
      if (line.trim() === '') continue;
      const record = {};

      for (const m of line.matchAll(
        /\s*(?<name>([A-Z#][a-z#:]* ?)*) +(?<value>[^\s\/]+(\/.*)?)/g,
      )) {
        const { name, value } = m.groups;
        record[name] = value;
      }
      records.push(record);
      todo -= 1;
      if (todo <= 0) break;
    }
    return records;
  },
  nameAddress: lines => {
    for (const line of lines) {
      if (line.trim() === '') continue;
      const parts = line.split('-');
      const [recipient, sender] = parts[0].split(/   \s+/);
      return {
        recipient,
        sender: [sender, ...parts.slice(1)].map(s => s.trim()),
      };
    }
    throw Error('??');
  },
  tables: (lines, cols = [5, 3]) => {
    const out = {
      major: undefined,
      minor: undefined,
      detail: [],
      summary: undefined,
    };

    const row = line => line.trim().split(/   \s+/);

    const hrows = line => {
      const cells = row(line);
      if (cells.length > sum(cols)) {
        console.error('@@@', cells, cols);
      }
      const fill = new Array(sum(cols) - cells.length).fill('');
      const out = [];
      let l = 0;
      for (const w of cols) {
        const r = l + w;
        out.push([...fill, ...cells].slice(l, r));
        l = r;
      }

      return out;
    };

    for (const line of lines) {
      if (out.major === undefined) {
        if (line.trim() === '') continue;
        out.major = row(line);
        continue;
      }
      if (out.minor === undefined) {
        if (line.trim() === '') continue;
        out.minor = hrows(line);
        continue;
      }
      if (out.summary === true) {
        if (line.trim() === '') continue;
        out.summary = hrows(line).reverse();
        break;
      }
      if (line.trim() === '') {
        out.summary = true;
        continue;
      }
      out.detail.push(hrows(line));
    }
    return out;
  },
};

const format = {
  fieldRows: (objs, skip) => {
    const chunks = [];
    for (const obj of objs) {
      chunks.push('<tr>');
      if (skip) chunks.push(`<td colspan=${skip}>`, '</td>');
      for (const [th, td] of entries(obj)) {
        chunks.push(`<th>${th}</th>`, `<td>${td}</td>`);
      }
      chunks.push('</tr>\n');
    }
    return chunks;
  },
  toFrom: ({ recipient, sender }) => {
    return [
      '<tr>',
      '<td>',
      recipient,
      '</td>',
      '<td colspan=4>',
      sender.join('<br />'),
      '</td>',
    ];
  },

  tables: ({ major, minor, detail, summary }) => {
    const chunks = [];
    const cols = minor.map(r => r.length);
    chunks.push(
      '<tr>',
      ...zip(major, cols).map(
        ([hd, colspan]) => `<th colspan=${colspan}>${hd}</th><td></td>`,
      ),
      '</tr>\n',
    );

    const sideBySide = rows => {
      chunks.push('<tr>');
      for (const [colspan, row] of zip(cols, rows)) {
        for (let fill = colspan - row.length; fill > 0; fill -= 1) {
          chunks.push('<td></td>');
        }
        for (const td of row) {
          chunks.push('<td>', td, '</td>');
        }
        chunks.push('<td></td>');
      }
      chunks.push('</tr>\n');
    };
    sideBySide(minor);
    detail.forEach(sideBySide);
    sideBySide(summary);
    return chunks;
  },
};

const main = async ({ stdin, stdout }) => {
  const txt = await read(stdin);
  const lines = txt.split('\n')[Symbol.iterator]();

  const writeChunks = chunks => {
    for (const chunk of chunks) {
      stdout.write(chunk);
    }
  };

  writeChunks(['<table border=1>\n']);
  writeChunks(format.fieldRows(parse.across(lines), 1));
  writeChunks(format.toFrom(parse.nameAddress(lines)));
  writeChunks(format.fieldRows(parse.across(lines, 2)));

  writeChunks(format.tables(parse.tables(lines, [5, 3])));
  writeChunks(format.tables(parse.tables(lines, [3, 2])));
  writeChunks(format.tables(parse.tables(lines, [2, 2, 3])));
  writeChunks(['</table>\n']);
};

main(process).catch(err => console.error(err));
