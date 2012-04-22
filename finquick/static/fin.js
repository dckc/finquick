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
function AccountsCtrl(Account, AccountSummary) {
    var self = this;

    self.summary = AccountSummary.query();

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

	self.selected = children(root).$filter({'hidden': false}
					      ).$orderBy('name');
    });
}
AccountsCtrl.$inject = ['Account', 'AccountSummary'];


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
}
TransactionsCtrl.$inject = ['Transaction', '$log'];

// todo: testing
