/*global CapperConnect */

import Bacon from 'baconjs';
import _ from 'underscore';

export function ui(budget, $) {
    // TODO: triggers
    const onlineStatus = Bacon.once(null)
	.merge(Bacon.interval(60 * 1000, null))
	.flatMap(() => Bacon.fromPromise(budget.post('onlineStatus')))
	.skipDuplicates(_.isEqual);

    onlineStatus.onValue(
	accounts => {
	    const rows = accounts
		.map(acct => [
                    elt('td', fmtDate(new Date(acct.latest))),
                    elt('td', acct.code),
                    elt('td', [
                        elt('label', [
                            elt('input', '',
                        	{type: 'checkbox',
				 name: 'code',
				 value: acct.code}),
			    acct.name])],
		       {'class': 'form-group'}),
		    moneyElt('td', acct.balance)])
		.map(cells => elt('tr', cells));
	    $('#accounts').html(rows);
	});

    const selectedCodes =  $('#fetchOFX').asEventStream('click')
        .map(event => $.makeArray(
            $('#accounts input:checkbox:checked')
	        .map((i, box) => $(box).val())));

    Bacon.combineWith(
        (accounts, codes) =>
            accounts.filter(acct => codes.indexOf(acct.code) >= 0),
        onlineStatus,
        selectedCodes)
        .onValue(
            // should be foreach rather than map,
            // but chrome doesn't seem to grok
            accounts => accounts.map(fetch));

    function fetch (acct) {
	budget.post('fetchNew', acct.code, acct.latest).then(splits => {
            const rows = splits.map(
		split =>
		    elt('tr', [
			elt('td', split.post_date),
			moneyElt('td', split.amount),
			elt('td', split.description),
			elt('td', split.memo)],
			{title: split.fid}) );
            $('#splits').html(rows);
	}, function(oops) {
            stderr(oops);
	});
    }
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

function moneyElt(tag, amt) {
    const attrs = {'class': 'text-right'}
    if (amt < 0) {
        attrs['style'] = 'color: red';
    }
    return elt(tag, bal.format(amt), attrs);
}

function fmtDate(d) {
    // const [ymd, y, m, d] = /(\d{4})(\d\d)(\d\d)/.exec(s);
    return d.toISOString().substr(0, 10);
}


