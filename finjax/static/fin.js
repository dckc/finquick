// cribbed from http://docs.angularjs.org/#!/tutorial/step_05

angular.service('Account', function($resource) {
    return $resource('../account/:guid', {}, {
	query: {method: 'GET', params: {guid: '-'}, isArray: true}
    });
});


// todo: consider whether global controllers are fine.
function AccountsCtrl(Account) {
    var self = this;

    self.accounts = Account.query({}, function(accounts) {
	var a;
	var parents = {};
	var account_index = {}; // by guid
	var acct;

	roots = angular.Array.filter(accounts,
				     function(a) {
					 return a.account_type == 'ROOT'
				     });
	self.root = roots[0];  // TODO: what if there is none?

	for (a = 0; a < accounts.length; a++) {
	    acct = accounts[a];
	    account_index[acct.guid] = acct;
	}
	self.account_index = account_index;

	self.children = function(pacct) {
	    return angular.Array.filter(
		accounts,
		function(ch) {
		    return ch.parent_guid == pacct.guid;
		});
	};
    });
}
AccountsCtrl.$inject = ['Account'];


angular.service('Transaction', function($resource) {
    return $resource('../transaction/:guid', {}, {
	// override the query method to make sure the trailing / is kept
	query2: {method: 'GET', params: {guid: '-'},
		 isArray: true, verifyCache: true}
    });
});


function TransactionsCtrl(Transaction, $log) {
    var self = this;

    self.matches = [{tx: {post_date: '2012-01-01',
			  description: 'fun fun'},
		     split: {memo: 'memo',
			     amount_num: 200,
			     amount_denom: 100}}];
    self.search = function(qtxt) {
	$log.info('search query text: ' + qtxt);
	self.matches = Transaction.query2({q: qtxt}, function(res, hdrs) {
	    $log.info('matches: ' + res.length);
	});
    }
}
TransactionsCtrl.$inject = ['Transaction', '$log'];

// todo: testing
