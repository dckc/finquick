const { freeze } = Object;

const { log } = console; // ocap exception for logging

log('running!');

export function ui({ on, setValue, localStorage, setSrc }) {
    log('ui!');

    on('form', 'submit', (ev) => { e.preventDefault(); });


    let calAddr = localStorage.getItem('calAddr');
    const state = {
        get calAddr() {
            return calAddr;
        },
        set calAddr(value) {
            localStorage.setItem('calAddr', value);
            setSrc('#ical', value);
            calAddr = value;
        }
    }

    on('#calAddr', 'change', (ev) => {
        log('callAddr change:', ev.target.value);
        state.calAddr = ev.target.value;
    });

    setValue('#calAddr', state.calAddr);
    setSrc('#ical', state.calAddr);
}
