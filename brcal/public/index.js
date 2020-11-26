import { ui } from './script.js';

function the(x) {
    if (!x) throw new Error('unexpected null / undefined');
    return x;
}

const $ = (sel) => the(document.querySelector(sel));

ui({
    on: (sel, name, handle) => $(sel).addEventListener(name, handle),
    setValue: (sel, val) => { $(sel).value = val; },
    setSrc: (sel, addr) => { $(sel).src = addr; },
    localStorage: localStorage,
});
