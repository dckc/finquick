/*global CapperConnect */

import Bacon from 'baconjs';
import _ from 'underscore';

export function ui(budget, $) {
    const onSplit = handleText =>
        budget.post('subscriptions').then(ps => {
            const [port, tableSubs] = ps;
            const host = 'pav'; // @@get from window.url or something?
            const addr = `wss://${host}:${port}`;
            // TODO: handle disconnect / reconnect
            const ws = new WebSocket(addr); // @@ambient
            ws.onopen = () => ws.send(tableSubs.splits);
            ws.onmessage = e => handleText(e.data);
        }).done();

    const splitEdit = Bacon.fromBinder(
        sink => onSplit(txt => {
            console.log(txt);
            sink(Try(() => JSON.parse(txt)));
        }));

    const interesting = a => a.balance != 0 || a.latest > 0;
    const currentAccounts = Bacon.once(null)
        .concat(splitEdit.debounce(0.3 * 1000))
        .flatMap(edit => Bacon.fromPromise(budget.post('currentAccounts')))
        .map(accounts => accounts.filter(interesting))
	.skipDuplicates(_.isEqual);

    Bacon.once(null).awaiting(currentAccounts).onValue(loading => {
        if (! loading) {
            $('#loading').modal('hide');
        }
    });

    const renderAcct = acct => elt('tr', [
        elt('td', acct.code),
        elt('td', [
            elt('label', [
                elt('input', '',
                    {type: 'radio',
		     name: 'code',
		     value: acct.code}),
		acct.name])],
	    {'class': 'form-group'}),
	moneyElt('td', acct.balance),
        elt('td', fmtDate(new Date(acct.latest)))]);

    currentAccounts.onValue(
	accounts => {
	    const rows = accounts.map(renderAcct);
            const total = accounts.map(a => a.balance).reduce((x, y) => x + y);
            const totalRow = elt('tr', [
                elt('td', [], {colspan: 2}),
                moneyElt('td', total, true)]);
                        
	    $('#accounts').html([].concat(rows, [totalRow]));
	});

    function results(button, method) {
        function checked(accounts) {
            const codes = $.makeArray(
                $('#accounts input:checked')
	            .map((i, box) => $(box).val()));
            return accounts.filter(acct => codes.indexOf(acct.code) >= 0);
        }

        const hr = 60 * 60 * 1000;
        const maxAge =
            () => parseInt($('input[name="maxAge"]').val()) * hr;

        const requests = button.asEventStream('click');
        const responses = Bacon.combineWith(
            (accounts, _) => checked(accounts),
            currentAccounts, requests)
            .flatMap(Bacon.fromArray)
            .flatMap(acct => Bacon.fromPromise(
                budget.post(method, acct.code, acct.latest, maxAge())));

        const replies = responses.merge(responses.mapError(err => null));
        requests.awaiting(replies).onValue(loading => {
            button.attr('disabled', loading);
            if (loading) {
                $('#fetchInfo').hide();
                $('#importInfo').hide();
            }
        });

        responses.onError(
            err => {
                const msg = typeof err === 'string' ? err : JSON.stringify(err);
                $('#errorMessage').text(msg);
                $('#error').modal('show');
            });

        return responses;
    }

    const previewSplits = results($('#fetchOFX'), 'fetchNew');
    const importSplits = results($('#importOFX'), 'importRemote');

    const renderSplit = split =>
	elt('tr', [
	    elt('td', [fmtDate(new Date(split.post_date))],
                {style: 'white-space: nowrap'}),
	    elt('td', split.checknum),
	    moneyElt('td', split.amount),
	    elt('td', split.trntype),
	    elt('td', split.description),
	    elt('td', split.memo)],
	    {title: split.fid});

    previewSplits.merge(importSplits)
        .onValue(info => {
            const t = new Date(info.fetchedAt);
            $('#fetchedAt').text(t.toString());
            $('#fetchedQty').text(info.fetchedQty.toString());
            $('#newQty').text(info.splits.length.toString());
            $('#fetchInfo').show();

            $('#splits').html(info.splits.map(renderSplit));
        });
    importSplits.onValue(info => {
        $('#importQty').text(info.importQty.toString());
        $('#importInfo').show();
    });

}


function Try(thunk) {
    try {
        return new Bacon.Next(thunk());
    } catch (e) {
        return new Bacon.Error(e);
    }
}


const bal = new Intl.NumberFormat("en-US",
				  { style: "currency", currency: "USD",
				    minimumFractionDigits: 2 });

function elt(tag, children, attrs) {
    const e = $(document.createElement(tag)); // AMBIENT global document
    e.append(children);
    for (let a in attrs) {
	e.attr(a, attrs[a]);
    }
    return e;
}

function moneyElt(tag, amt, total) {
    const style = 'white-space: nowrap; ' +
        (amt < 0 ? 'color: red; ' : '') +
        (total ? 'font-weight: bold; ' : '');
    const attrs = {'class': 'text-xs-right',
                   'style': style};
    return elt(tag, bal.format(amt), attrs);
}

function fmtDate(d, chop=10) {
    // const [ymd, y, m, d] = /(\d{4})(\d\d)(\d\d)/.exec(s);
    return d > 0 ? d.toISOString().substr(0, chop) : '';
}


