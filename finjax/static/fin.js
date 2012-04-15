// cribbed from http://docs.angularjs.org/#!/tutorial/step_05

// todo: consider whether global controllers are fine.
function AccountsCtrl($xhr) {
    var self = this;
    $xhr('GET', '../accounts', function(code, response) {
	self.accounts = response;
    });
}


AccountsCtrl.$inject = ['$xhr'];

// todo: testing
