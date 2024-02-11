// @ts-check
import {
  html,
  useEffect,
  useState,
} from 'https://unpkg.com/htm/preact/standalone.module.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js';

console.log('@@txUi module');

/**
 * @param {object} io
 * @param { typeof document } io.document
 * @param { typeof fetch } io.fetch
 * @param { typeof localStorage } io.localStorage
 * @param { typeof import('fuse.js').default } io.Fuse
 */
export const main = ({ fetch, document, localStorage, Fuse }) => {
  console.log('@@main');
  document.addEventListener('DOMContentLoaded', ev => {
    console.log('content ready@@');

    fetch('/txs').then(resp => {
      if (resp.status !== 200) {
        throw resp;
      }
      resp.text().then(txt => {
        console.log('got text@@', txt.slice(0, 20));
        const lines = txt.split('\n').filter(line => line > '');
        console.log(lines[0]);
      });
    });
  });
};

const opts = {
  keys: [
    'date',
    'num',
    'description',
    { name: 'memo', getFn: tx => tx.splits.map(s => s.memo).join(' ') },
    { name: 'value', getFn: tx => tx.splits.map(s => `${s.value}`).join(' ') },
  ],
  threshold: 0.3,
  minMatchCharLength: 3,
};

export const TxRegister = () => {
  const [items, setItems] = useState([]);
  const [fuse, setFuse] = useState(new Fuse([], opts));
  const [pattern, setPattern] = useState('');
  const [matches, setMatches] = useState([]);

  console.warn('AMBIENT: window.localStorage');
  navigator.storage.estimate().then(est => console.log(est));
  const { localStorage } = window;

  useEffect(() => {
    const found = localStorage.getItem('/txs');
    if (!found) return;
    const lines = found.split('\n').filter(line => line > '');
    setItems(lines);
  });

  const load = async () => {
    const resp = await fetch('/txs');
    if (resp.status !== 200) {
      throw resp;
    }
    const txt = await resp.text();
    console.log('got text@@', txt.length, txt.slice(0, 20));
    const lines = txt.split('\n').filter(line => line > '');
    console.log(lines[0]);
    const txs = lines.map(line => JSON.parse(line));
    setItems(txs);
    setFuse(new Fuse(txs, opts));
    localStorage.setItem('/txs', txt);
  };

  const search = () => {
    console.log('@@search', pattern);
    const hits = fuse.search(pattern);
    setMatches(hits);
  };

  return html`
    <form onSubmit=${e => e.preventDefault()}>
      <fieldset>
        <legend>Transaction Search</legend>
        <input name=${pattern} onInput=${e => setPattern(e.target.value)} />
        <input type="submit" value="Search" onClick=${search} />
        <br />
        <button type="button" onClick=${load}>Load Transactions</button>
        <div>Transactions loaded: ${items.length}</div>
      </fieldset>
    </form>
    <table class="report">
      <thead>
        <th style="width: 8em">Date</th>
        <th style="width: 2em">Num</th>
        <th style="width: 10em">Description</th>
        <th style="width: 2em">Code</th>
        <th>Account</th>
        <!-- <th>Status</th> -->
        <th>Amount</th>
      </thead>
      <tbody>
        ${matches.map(match => {
          const tx = match.item;
          return html`
            <tr>
              <td id=${tx.tx_guid} title=${tx.tx_guid}>${tx.date}</td>
              <td>${tx.num}</td>
              <td>${tx.description}</td>
            </tr>
            ${tx.splits.map(s => {
              return html`
                <tr>
                  <td colspan="2"></td>
                  <td>${s.memo}</td>
                  <td>${s.code}</td>
                  <td>${s.account}</td>
                  <td class="amount">${s.value}</td>
                </tr>
              `;
            })}
          `;
        })}
      </tbody>
    </table>
  `;
};
