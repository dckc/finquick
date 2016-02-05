/*global CapperConnect */

import Bacon from 'baconjs';
import _ from 'underscore';

export function ui(budget, $) {
    // TODO: triggers
    const currentAccounts = Bacon.once(null)
	.merge(Bacon.interval(60 * 1000, null))
	.flatMap(() => Bacon.fromPromise(budget.post('currentAccounts')))
        .map(accounts => accounts.filter(
            a => a.balance != 0 || a.latest > 0))
	.skipDuplicates(_.isEqual);

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
            () => parseInt($('input[name="maxAge"]:checked').val()) * hr;

        const requests = button.asEventStream('click');
        const responses = Bacon.combineWith(
            (accounts, _) => checked(accounts),
            currentAccounts, requests)
            .flatMap(Bacon.fromArray)
            .flatMap(acct => Bacon.fromPromise(
                budget.post(method, acct.code, acct.latest, maxAge())));

        const replies = responses.merge(responses.flatMapError(err => null));
        requests.awaiting(replies).onValue(loading => {
            if (loading) { button.button('loading'); }
            else { button.button('reset'); }
        });

        responses.onError(
            err => {
                $('#errorMessage').text(err.toString());
                $('#error').modal('show');
            });

        return responses;
    }

    const previewSplits = results($('#fetchOFX'), 'fetchNew');
    const importSplits = results($('#importOFX'), 'importRemote');

    const renderSplit = split =>
	elt('tr', [
	    elt('td', fmtDate(new Date(split.post_date))),
	    elt('td', split.checknum),
	    moneyElt('td', split.amount),
	    elt('td', split.trntype),
	    elt('td', split.description),
	    elt('td', split.memo)],
	    {title: split.fid});

    previewSplits.merge(importSplits)
        .onValue(splits => {
            $('#splits').html(splits.map(renderSplit));
        });
}


const bal = new Intl.NumberFormat("en-US",
				  { style: "currency", currency: "USD",
				    minimumFractionDigits: 2 });

function elt(tag, children, attrs) {
    const e = $(document.createElement(tag));
    e.append(children);
    for (let a in attrs) {
	e.attr(a, attrs[a]);
    }
    return e;
}

function moneyElt(tag, amt, total) {
    const style = (amt < 0 ? 'color: red ' : '') +
        (total ? 'font-weight: bold ' : '');
    const attrs = {'class': 'text-xs-right',
                   'style': style};
    return elt(tag, bal.format(amt), attrs);
}

function fmtDate(d) {
    // const [ymd, y, m, d] = /(\d{4})(\d\d)(\d\d)/.exec(s);
    return d > 0 ? d.toISOString().substr(0, 10) : '';
}


