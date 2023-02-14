require('object-assign-shim'); // ES6 Object.assign

var Banking = require('banking');

    var institutions = {
        discover: {
            fid: 7101
            , fidOrg: 'Discover Financial Services'
            , url: 'https://ofx.discovercard.com'
            , bankId: null /* not a bank account */
            , accType: 'CREDITCARD'
        },
        amex: {
            fid: 3101
            , fidOrg: 'American Express Card'
            , url: 'https://online.americanexpress.com/myca/ofxdl/desktop/desktopDownload.do?request_type=nl_ofxdownload'
            , bankId: null /* not a bank */
            , accType: 'CREDITCARD'
        }
    };



function ofxDateFmt(d) {
  return d.toISOString().substring(0, 20).replace(/[^0-9]/g, '');
}

function daysBefore(n, d) {
  var msPerDay = 24 * 60 * 60 * 1000;
  return new Date(d.getTime() - n * msPerDay);
}

var info = Object.assign(
    {
	accId: process.env.CARDNUM
	, user: process.env.OFX_USERNAME
	, password: process.env.OFX_PASSWORD},
    institutions.discover);
console.log('myCard', info);
var myCard = new Banking(info);

var clock = function() { return new Date() };
var now = clock();

myCard.getStatement({start: ofxDateFmt(daysBefore(60, now)),
		     end: ofxDateFmt(now)}, function(err, res){
  if(err) console.log(err)
  console.log(res);
});

