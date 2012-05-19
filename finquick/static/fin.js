// cribbed from http://docs.angularjs.org/#!/tutorial/step_05

var FinModule = angular.module('FinModule', ['ngResource']);
FinModule.factory('AccountSummary', function($resource) {
    return $resource('../accountSummary');
});

FinModule.factory('OFXImport', function($resource) {
    return $resource('../ofx_import', {}, {
	prepare: {method: 'POST'},
	/* TODO: execute should take a cap from prepare. */
	execute: {method: 'POST'},
    });
});

// todo: consider whether global controllers are fine.
function AccountsCtrl(AccountSummary, OFXImport, $scope, $log) {
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

    $scope.summary = AccountSummary.query({}, function(accts) {
	$log.info('summary query results in. self.summary:' + $scope.summary.length);

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
	$scope.summary = inorder;

	$scope.toggle(root, 1);
    });

    $scope.toggle = function(parent, expanded) {
	if (expanded === undefined) {
	    expanded = !parent.expanded ? true : false;
	}
	parent.expanded = expanded;
	$log.info('toggle: ' + parent.name + ' to: ' + expanded);
	$scope.selected_account = parent;  // for file upload. kludge?
    };

    $scope.visibility = function(acct) {
	// todo: option to show hidden accounts
	var v = (!acct.hidden) &&
	    acct.parent_guid &&
	    acct.parent.expanded &&
	    (acct.level <= 1 || $scope.visibility(acct.parent) > 0);
	return v ? (
	    acct.children ? (
		acct.expanded ? 3 : 2 )
	    : 1) : 0;
    };

    $scope.selected_account = null;
    $scope.ofx_file = null;
    $scope.ofx_summary = null;
    $scope.note_ofx_file = function(elt) {
	alert(elt.value);
    }

    $scope.prepare = function() {
	console.log('in prepare() scope.ofx_file:' + $scope.ofx_file);
	// http://www.w3.org/TR/FileAPI/
	var reader = new FileReader();
	reader.readAsText($scope.ofx_file, 'utf-8'); // blob? win 1252?
	reader.onerror = function() {
	    console.log('reader LOSE! @@');
	};
	reader.onload = function(evt) {
	    var content = evt.target.result;
	    var body = angular.toJson({
		account_guid: $scope.selected_account.guid,
		ofx_data: content});
	    console.log('WIN!: ' + content.substr(1, 20));

	    OFXImport.prepare({}, body, function (response_body) {
		console.log('prepare POST success.');
		var data = angular.fromJson(response_body);
		console.log('JSON decode:' + Object.keys(data));
		$scope.$evalAsync(function(s) {
		    console.log('import prepare evalAsync');
		    s.ofx_prep = data;
		});
	    }, function (x) {
		console.log('prepare POST failure.');
	    });
	};
    }
}
AccountsCtrl.$inject = ['AccountSummary', 'OFXImport', '$scope', '$log'];

FinModule.filter('indent', function () {
    return function(n, chr) {
	var i, s = '';
	for (i = 0; i < n; i++) {
	    s = s + chr;
	}
	return s;
    };
});


/* based on
File upload - how to / examples?
Oct 2011
https://groups.google.com/group/angular/browse_thread/thread/334a155cbc886c92/bcb5b998f0fac10f?lnk=gst&q=file+upload#bcb5b998f0fac10f
http://jsfiddle.net/vojtajina/epCyK/a
hmm... and http://docs.angularjs.org/guide/directive
*/

FinModule.directive('finFile', function() {
    console.log('registering fin_file directive.');
    return {
	compile: function(telm, tattrs) {
	    var choice = tattrs.finFile;

	    return function(scope, elm, attrs) {
		elm.bind('change', function() {
		    var f;
		    if (this.files) {
			f = this.files[0];
			console.log('files[0]: ' + f);
			scope.$apply(function(scope) {
			    scope[choice] = f;
			});
		    }
		});
	    };
	}
    };
});

FinModule.factory('Transaction', function($resource) {
    return $resource('../transaction/:guid', {}, {
	// override the query method to make sure the trailing / is kept
	query: {method: 'GET', params: {guid: '-'},
		isArray: true, verifyCache: true}
    });
});


function TransactionsCtrl(Transaction, $scope, $log) {
    var $scope = this;

    $scope.matches = [{post_date: '2012-01-01',
		     description: 'fun fun',
		     splits: [{
			 memo: 'memo',
			 account_type: 'BANK',
			 account_name: 'Friendly Bank',
			 value_num: 200,
			 value_denom: 100}]}];
    $scope.search = function(qtxt, account, amount) {
	$scope.matches = Transaction.query({q: qtxt, account: account,
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

    $scope.primaryAccount = function(tx) {
	return simpleTx(tx) ? tx.payment.account_name : null;
    };
    $scope.primaryTransfer = function(tx) {
	return simpleTx(tx) ? tx.transfer.account_name : null;
    };
    var splitAmount = function(s, sign) {
	var amount = sign * (s.value_num / s.value_denom);
	return amount > 0 ? amount : NaN;
    };
    $scope.splitAmount = splitAmount;

    $scope.primaryAmount = function(tx, sign) {
	return simpleTx(tx) ? splitAmount(tx.payment, sign) : NaN;
    };
    $scope.details = function(tx) {
	return simpleTx(tx) ? [] : tx.splits;
    };
}
TransactionsCtrl.$inject = ['Transaction', '$log'];

// todo: testing
