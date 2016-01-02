var ui;

window.onload = function() {
  var byId = function(i) { return document.getElementById(i); };

  ui = {
    description: byId('description'),
    url: byId('url')
  };

  update();
}

function update() {
  CapperConnect.home.post('link').then(function (link) {
    ui.description.value = link.description;
    ui.url.value = link.url;
  });
}

function setUp() {
  CapperConnect.home.post(
    'init',
    ui.description.value,
    ui.url.value,
    "@@username",
    "@@password",
    "@@acct").then(
	function() {
	    update();
	});
}
