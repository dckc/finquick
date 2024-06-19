// @ts-check
import { csv2ofx } from './csv2ofx.js';

console.log('ui module');

/**
 * @param {object} io
 * @param {(sel: string) => HTMLInputElement} io.getInput
 * @param {(sel: string) => HTMLAnchorElement} io.getAnchor
 * @param {() => number} io.now
 */
const ui = ({ getInput, getAnchor, now }) => {
  const elt = {
    theFile: getInput('#theFile'),
    acctId: getInput('#acctId'),
    ofx: getInput('#ofx'),
    download: getAnchor('#download'),
  };

  elt.theFile.addEventListener('change', async event => {
    console.log('change event:', event);
    const acctId = elt.acctId.value;
    const dtServer = new Date(now());
    const file = event?.target?.files[0];
    const content = await file.text();
    const ofx = csv2ofx({ acctId, dtServer, content });
    elt.ofx.value = ofx;

    const blob = new Blob([ofx], { type: 'application/octet-stream' });
    const downloadUrl = URL.createObjectURL(blob);
    elt.download.href = downloadUrl;
    elt.download.download = 'discover.ofx';
  });
};

export default ui;
