/* global document, window, CapperConnect, CapperLayout, stderr, $ */

var ui;

window.onload = function() {
    var byId = function(i) { return document.getElementById(i); };

    ui = {
        expenseName: byId('expenseName'),
        since: byId('since'),
        balCode: byId('balCode')
    };
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
    var balCode = ui.balCode.value;
    var budget = CapperConnect.home;

    budget.post('fetch', balCode).then(function(reply) {
        var stmt = reply.body.OFX.CREDITCARDMSGSRSV1[0].CCSTMTTRNRS[0].CCSTMTRS[0];
        var txnsElt = C.jtable();
        stmt.BANKTRANLIST[0].STMTTRN.forEach(function(trn) {
            var txElt = C.jrow(
                trn.DTPOSTED[0],
                trn.TRNAMT[0],
                trn.TRNTYPE[0],
                trn.NAME[0]
            );
            txElt.attr('id', trn.FITID[0]);
            txElt.attr('title', trn.FITID[0]);
            txnsElt.append(txElt);        
        });
        $('#txns').html('');
        $('#txns').append(txnsElt);
    }, function(oops) {
        stderr(oops);
    });
};

window.getLedger = function() {
    var C = CapperLayout;
    var budget = CapperConnect.home;

    budget.post('getLedger', ui.expenseName.value, ui.since.value)
        .then(function(splits) {

        var splitsElt = C.jtable();
        splits.forEach(function(split) {
            var splitElt = C.jrow(
                split.post_date, split.description,
                split.amount, split.memo
            );
            splitElt.attr('id', split.guid);
            splitElt.attr('title', split.fid);
            splitsElt.append(splitElt);
        });
        $('#splits').html('');
        $('#splits').append(splitsElt);
    }, function(oops) {
        stderr(oops);
    });
};
