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

    function accountsCommand(button) {
        function checked(accounts) {
            const codes = $.makeArray(
                $('#accounts input:checkbox:checked')
	            .map((i, box) => $(box).val()));
            return accounts.filter(acct => codes.indexOf(acct.code) >= 0);
        }

        return Bacon.combineWith(
            (accounts, event) => checked(accounts),
            onlineStatus, button.asEventStream('click'));
    }

    // should be foreach rather than map,
    // but chrome doesn't seem to grok
    accountsCommand($('#fetchOFX'))
        .onValue(accounts => accounts.map(fetch));

    function fetch (acct) {
	budget.post('fetchNew', acct.code, acct.latest).then(splits => {
            const rows = splits.map(
		split =>
		    elt('tr', [
			elt('td', split.post_date),
			elt('td', split.checknum),
			moneyElt('td', split.amount),
			elt('td', split.trntype),
			elt('td', split.description),
			elt('td', split.memo)],
			{title: split.fid}) );
            $('#splits').html(rows);
	}, function(oops) {
            stderr(oops);
	});
    }

    accountsCommand($('#importOFX'))
        .onValue(accounts => accounts.map(importRemote));

    function importRemote(acct) {
        //@@waiting indicator
        //@@handle errors
        budget.post('importRemote', acct.code, acct.latest)
            .then(() => fetch(acct));
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


