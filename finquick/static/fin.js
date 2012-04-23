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
    self.accounts = Account.query();

    self.children = function(pacct, tree) {
	if (!tree || !pacct) {
	    return [];
	}
	return angular.Array.filter(tree, {parent_guid: pacct.guid});
    };

    self.root = function() {
	roots = angular.Array.filter(self.accounts, {account_type: 'ROOT'});
	return roots[0];  // TODO: what if there is none?
    };
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
