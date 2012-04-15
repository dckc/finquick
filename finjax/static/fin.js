// cribbed from http://docs.angularjs.org/#!/tutorial/step_05

// todo: consider whether global controllers are fine.
function AccountsCtrl($xhr) {
    var self = this;

    $xhr('GET', '../accounts', function(code, response) {
	var a;
	var parents = {};
	var account_index = {}; // by guid
	var acct;

	self.accounts = response;

	roots = angular.Array.filter(self.accounts,
				     function(a) {
					 return a.account_type == 'ROOT'
				     });
	self.root = roots[0];  // TODO: what if there is none?

	for (a = 0; a < self.accounts.length; a++) {
	    acct = self.accounts[a];
	    account_index[acct.guid] = acct;
	}
	self.account_index = account_index;

	self.children = function(pacct) {
	    return angular.Array.filter(
		self.accounts,
		function(ch) {
		    return ch.parent_guid == pacct.guid;
		});
	};
    });
}


AccountsCtrl.$inject = ['$xhr'];

// todo: testing
