/*global CapperConnect */

import Bacon from 'baconjs';
import _ from 'underscore';

export function ui(budget, $) {
    // TODO: triggers
    const onlineStatus = Bacon.once(null)
	.merge(Bacon.interval(5 * 1000, null))
	.flatMap(() => Bacon.fromPromise(budget.post('onlineStatus')))
	.skipDuplicates(_.isEqual);

    onlineStatus.onValue(
	accounts => {
	    const rows = accounts
		.map(acct => [
		    elt('input', '',
			{type: 'checkbox',
			 'class': 'form-control',
			 name: 'code',
			 value: acct.code}),
		    elt('td', acct.name),
		    elt('td', bal.format(acct.balance),
			{'class': 'text-right'}),
		    elt('td', fmtDate(new Date(acct.latest)))])
		.map(cells => elt('tr', cells));
	    $('#accounts').html(rows);
	});

    $('#fetchOFX').asEventStream('click')
	.map(() => $('#accounts input:checkbox:checked')
	     .map((i, e) => $(e).val()) )
	.onValue(codes => $.makeArray(codes).forEach(fetch))

    function fetch (balCode) {
	var C = CapperLayout;
	var budget = CapperConnect.home;

	budget.post('fetch', balCode).then(txns => {
            const rows = txns.map(
		trn =>
		    elt('tr', [
			elt('td', trn.DTPOSTED[0]),
			elt('td', trn.TRNAMT[0]),
			elt('td', trn.TRNTYPE[0]),
			elt('td', trn.NAME[0])],
			{id: trn.FITID[0],
			 title: trn.FITID[0]}) );
            $('#txns').html(elt('table', rows));
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

function fmtDate(d) {
    // const [ymd, y, m, d] = /(\d{4})(\d\d)(\d\d)/.exec(s);
    return d.toISOString().substr(0, 10);
}


