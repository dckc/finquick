// cribbed from http://docs.angularjs.org/#!/tutorial/step_05

angular.service('Account', function($resource) {
    return $resource('../account/:guid', {}, {
	query: {method: 'GET', params: {guid: '-'}, isArray: true}
    });
});


angular.service('AccountSummary', function($resource) {
    return $resource('../accountSummary');
});


// todo: consider whether global controllers are fine.
function AccountsCtrl(Account, AccountSummary, $log) {
    var self = this;
    var account_index = {}; // by guid
    var root;
    var children = {}; // guid -> [account]

    $log.info('AccountsCtrl');

    var walk = function(acct, f) {
	var recur = function(acct, ancestors) {
	    f(acct, ancestors);
	    nextgen = children[acct.guid];
	    if (nextgen) {
		$log.info('children of: ' + acct.name + ': ' + nextgen.length);
		angular.forEach(nextgen, function(a) {
		    recur(a, ancestors.concat([a]))
		});
	    }
	};
	recur(acct, []);
    };

    self.summary = AccountSummary.query({}, function(accts) {
	$log.info('summary query results in. self.summary:' + self.summary.length);

	root = null;
	account_index = {};
	children = {};

	$log.info('indexing ' + accts.length + ' accounts by guid.');
	angular.forEach(accts, function(a) {
	    var siblings = children[a.parent_guid];
	    account_index[a.guid] = a;

	    if (!siblings) {
		children[a.parent_guid] = siblings = [];
	    }
	    siblings.push(a);

	    // Actually, we need the server to tell us which is
	    // the root of the book, since there is an account root
	    // and a template root.

	    if (!a.parent_guid) {
		if (root) {
		    $log.warn('already saw root:' + root.guid);
		} else {
		    root = a;
		}
	    }
	});

	$log.info('walking tree of accounts, starting at ' + root.guid);
	var inorder = [];
	walk(root, function (a, ancestors) {
	    inorder.push(a);
	    a.level = ancestors.length;
	    a.children = children[a.guid];
	    a.parent = account_index[a.parent_guid];
	});
	self.summary = inorder;

	self.toggle(root, 1);
    });

    self.toggle = function(parent, expanded) {
	if (expanded === undefined) {
	    expanded = !parent.expanded ? true : false;
	}
	parent.expanded = expanded;
	$log.info('toggle: ' + parent.name + ' to: ' + expanded);
    };

    self.visibility = function(acct) {
	// todo: option to show hidden accounts
	var v = (!acct.hidden) &&
	    acct.parent_guid &&
	    acct.parent.expanded &&
	    (acct.level <= 1 || self.visibility(acct.parent) > 0);
	return v ? (
	    acct.children ? (
		acct.expanded ? 3 : 2 )
	    : 1) : 0;
    };

    angular.filter('indent', function(n, chr) {
	var i, s = '';
	for (i = 0; i < n; i++) {
	    s = s + chr;
	}
	return s;
    });
}
AccountsCtrl.$inject = ['Account', 'AccountSummary', '$log'];


angular.service('Transaction', function($resource) {
    return $resource('../transaction/:guid', {}, {
	// override the query method to make sure the trailing / is kept
	query: {method: 'GET', params: {guid: '-'},
		isArray: true, verifyCache: true}
    });
});


function TransactionsCtrl(Transaction, $log) {
    var self = this;

    self.matches = [{post_date: '2012-01-01',
		     description: 'fun fun',
		     splits: [{
			 memo: 'memo',
			 account_type: 'BANK',
			 account_name: 'Friendly Bank',
			 value_num: 200,
			 value_denom: 100}]}];
    self.search = function(qtxt, account, amount) {
	self.matches = Transaction.query({q: qtxt, account: account,
					  amount: amount});
    }

    var simpleTx = function(tx) {
	if ('simple' in tx) {
	    return tx.simple;
	}

	if (tx.splits.length != 2) {
	    return tx.simple = false;
	}

	var isPrimary = function(s) {
	    return ['BANK', 'CASH', 'CREDIT'].indexOf(s.account_type) >= 0;
	}

	if (isPrimary(tx.splits[0])) {
	    tx.primaryIndex = 0;
	} else if (isPrimary(tx.splits[1])) {
	    tx.primaryIndex = 1;
	} else {
	    return tx.simple = false;
	}

	var pmt = tx.payment = tx.splits[tx.primaryIndex];
	var tfr = tx.transfer = tx.splits[1 - tx.primaryIndex];

	return tx.simple = true;
    };

    self.primaryAccount = function(tx) {
	return simpleTx(tx) ? tx.payment.account_name : null;
    };
    self.primaryTransfer = function(tx) {
	return simpleTx(tx) ? tx.transfer.account_name : null;
    };
    var splitAmount = function(s, sign) {
	var amount = sign * (s.value_num / s.value_denom);
	return amount > 0 ? amount : NaN;
    };
    self.splitAmount = splitAmount;

    self.primaryAmount = function(tx, sign) {
	return simpleTx(tx) ? splitAmount(tx.payment, sign) : NaN;
    };
    self.details = function(tx) {
	return simpleTx(tx) ? [] : tx.splits;
    };
}
TransactionsCtrl.$inject = ['Transaction', '$log'];

// todo: testing
