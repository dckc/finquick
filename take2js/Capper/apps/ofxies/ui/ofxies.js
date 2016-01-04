/* global document, window, CapperConnect, CapperLayout, stderr, $ */

var ui;

window.onload = function() {
    var byId = function(i) { return document.getElementById(i); };

    ui = {
        name: byId('name')
    };

    update();
};


function update() {
    CapperConnect.home.post('institution').then(function (institution) {
        institution.post('info').then(function(info) {
            // de-xss the fidOrg?
            document.title = document.title.replace('??', info.fidOrg);
            var h1 = document.getElementsByTagName('h1').item(0);
            h1.textContent = h1.textContent.replace('??', info.fidOrg);
        });
    });

    CapperConnect.home.post('name').then(function (name) {
        ui.name.value = name;
    });
}

window.fetch = function() {
    var C = CapperLayout;

    CapperConnect.home.post('fetch').then(function(reply) {
        var stmt = reply.body.OFX.CREDITCARDMSGSRSV1[0].CCSTMTTRNRS[0].CCSTMTRS[0];
        var txnsElt = C.jtable();
        stmt.BANKTRANLIST[0].STMTTRN.forEach(function(trn) {
            txnsElt.append(C.jrow(
                trn.DTPOSTED[0],
                trn.TRNAMT[0],
                trn.TRNTYPE[0],
                trn.NAME[0],
                trn.FITID[0]
            ));        
        });
        $('#txns').html('');
        $('#txns').append(txnsElt);
    }, function(oops) {
        stderr(oops);
    });
};
