/**
 * The books pages and their scripts, served on the app socket, whose
 * origin is the boot vat's own. A page keeps its webkey in localStorage: a
 * link's fragment (the boot page's `#<key>`, or a review page's) is read
 * once and taken out of the address bar.
 */

const STYLE = `<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
body { font: 16px/1.4 system-ui, sans-serif; max-width: 64rem; margin: 1rem auto; padding: 0 1rem; }
textarea { width: 100%; height: 10rem; font: 12px monospace; }
table { border-collapse: collapse; width: 100%; }
td, th { padding: .25rem .5rem; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
td.amount { text-align: right; font-variant-numeric: tabular-nums; }
td.date { white-space: nowrap; }
td.pick select, td.verdict input { width: 100%; box-sizing: border-box; }
.why { font-size: .85em; color: #555; margin-top: .2rem; }
td.verdict button { margin-top: .2rem; }
</style>`;

export const BOOT_PAGE = `<!doctype html><title>Books</title>${STYLE}
<h1>Books</h1>
<p id="status" role="status"></p>
<form id="make">
<p><label>What <code>git ls-tree -r &lt;tree&gt;</code> lists<br><textarea name="listing" required></textarea></label></p>
<p><label>Directory of the dump in the tree <input name="dir" value="dm93finance"></label> <button>Load</button></p>
</form>
<h2>Loaded</h2>
<ul id="books"></ul>
<h2>Model</h2>
<form id="model">
<p><label>API base URL <input name="url" size="40" placeholder="http://host:port/v1/"></label>
<label>model <input name="name" size="20"></label>
<label>API key <input name="key" type="password" size="20" placeholder="(unchanged)"></label> <button>Save</button></p>
</form>
<script src="/boot.js"></script>`;

/** The prelude both scripts share: `api(op, args)` POSTs with the page's key. */
const PRELUDE = `'use strict';
const $ = id => document.getElementById(id);
const el = (tag, text) => Object.assign(document.createElement(tag), text === undefined ? {} : { textContent: text });
const say = text => ($('status').textContent = text);
/** A failure: on the page, and in the console, where its stack is. */
const fail = err => {
  console.error(err);
  say(err.message);
};
/** The key in localStorage under name, after taking any from the fragment. */
const keyFor = name => {
  const fragment = location.hash.slice(1);
  if (fragment) {
    localStorage.setItem(name, fragment);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return localStorage.getItem(name);
};
const apiWith = key => async (op, args = {}) => {
  const r = await fetch('/api', { method: 'POST', body: JSON.stringify({ key, op, ...args }) });
  const j = await r.json();
  if (!r.ok) throw Error(j.error);
  return j;
};
`;

export const BOOT_SCRIPT = `${PRELUDE}
const api = apiWith(keyFor('books:key'));
const show = async () => {
  const instances = await api('instances');
  $('books').replaceChildren(...instances.map(i => {
    localStorage.setItem('books:review:' + i.tree, i.reviewerKey);
    const a = el('a', i.tree.slice(0, 12) + ' (' + i.dir + ')');
    a.href = '/review?tree=' + i.tree;
    const li = el('li');
    li.append(a);
    return li;
  }));
  const model = await api('model');
  $('model').url.value = model.url ?? '';
  $('model').name.value = model.name ?? '';
};
$('make').addEventListener('submit', async e => {
  e.preventDefault();
  say('loading…');
  try {
    const i = await api('makeBooks', { listing: e.target.listing.value, dir: e.target.dir.value });
    say('loaded tree ' + i.tree);
    await show();
  } catch (err) {
    fail(err);
  }
});
$('model').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('setModel', { url: f.url.value, name: f.name.value, ...(f.key.value ? { apiKey: f.key.value } : {}) });
    f.key.value = '';
    say('model saved');
  } catch (err) {
    fail(err);
  }
});
show().catch(fail);
`;

export const REVIEW_PAGE = `<!doctype html><title>Review</title>${STYLE}
<h1>Review</h1>
<p id="status" role="status"></p>
<p><button id="ask">Ask the model</button> for up to <input id="limit" type="number" value="10" min="1" size="4"> proposals</p>
<table>
<thead><tr><th>Date</th><th>Description</th><th>From</th><th>Amount</th><th>Proposed account</th><th>Your verdict</th></tr></thead>
<tbody id="pending"></tbody>
</table>
<p><button id="changelog">Download changelog</button></p>
<script src="/review.js"></script>`;

export const REVIEW_SCRIPT = `${PRELUDE}
const tree = new URLSearchParams(location.search).get('tree');
const api = apiWith(keyFor('books:review:' + tree));
const show = async () => {
  const [accounts, pending, summary] = await Promise.all([api('accounts'), api('pending'), api('summary')]);
  const { count, first, last } = summary.uncategorized;
  say(pending.length + ' proposals to review; ' + count + ' splits uncategorized' +
    (count ? ', ' + first + ' to ' + last : '') +
    (summary.rejected ? '; ' + summary.rejected + ' rejected here, which the model skips' : ''));
  $('pending').replaceChildren(...pending.map(p => {
    const tr = el('tr');
    const amount = el('td', p.amount.toFixed(2));
    amount.className = 'amount';
    const select = el('select');
    select.setAttribute('aria-label', 'account for ' + p.description);
    for (const a of accounts) select.append(Object.assign(el('option', a.name), { value: a.guid, selected: a.name === p.account }));
    const decide = el('button', 'Accept');
    select.addEventListener('change', () => (decide.textContent = select.selectedOptions[0].text === p.account ? 'Accept' : 'Correct'));
    const reject = el('button', 'Reject');
    const note = el('input');
    note.placeholder = 'why (optional)';
    note.setAttribute('aria-label', 'why, for ' + p.description);
    const review = async verdict => {
      try {
        await api('review', { n: p.n, verdict, note: note.value });
        await show();
      } catch (err) {
        fail(err);
      }
    };
    decide.addEventListener('click', () => review(select.selectedOptions[0].text === p.account ? 'accept' : { account: select.value }));
    reject.addEventListener('click', () => review('reject'));
    // the dropdown starts at the proposed account; the proposer's reason sits under it
    const pick = el('td');
    pick.className = 'pick';
    const why = el('div', p.reason);
    why.className = 'why';
    pick.append(select, why);
    const actions = el('td');
    actions.className = 'verdict';
    actions.append(note, el('br'), decide, ' ', reject);
    const date = el('td', p.date);
    date.className = 'date';
    tr.append(date, el('td', p.description), el('td', p.against.map(a => a.name).join(', ')), amount, pick, actions);
    return tr;
  }));
};
$('ask').addEventListener('click', async () => {
  say('asking the model…');
  try {
    const { proposed, refused } = await api('categorize', { limit: Number($('limit').value) });
    await show();
    // each refusal says why: the model named no such split or account, say
    for (const r of refused) console.warn('refused', r);
    say(proposed.length + ' proposed, ' + refused.length + ' refused' +
      (refused.length ? ': ' + refused.map(r => r.error).join('; ') : ''));
  } catch (err) {
    fail(err);
  }
});
$('changelog').addEventListener('click', async () => {
  const changes = await api('changelog');
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(changes, null, 2)], { type: 'application/json' }));
  a.download = 'changelog.json';
  a.click();
});
show().catch(fail);
`;
