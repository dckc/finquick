// cribbed from https://github.com/drudge/node-keychain/blob/master/keychain.js

var Q = require('q');

function integrationTestMain(argv, user, spawn, mysql) {
    var dbName = argv[2];

    var lookup = makeSecretLookup(spawn);

    lookup({
        'protocol': 'mysql',
        'server': 'localhost',
        'object': dbName
    }).then(function(password) {
        var withConnection = makeWithConnection(
            mysql,
            {
                host     : 'localhost',
                user     : user,
                password : password,
                database : dbName
            });

        getBalance(withConnection).then(function(b) {
            console.log('Balance: ', b);
        });
    });
}


function makeSecretLookup(spawn) {
    var toolPath = 'secret-tool';

    function lookup(what) {
        var args = ['lookup'];
        for (var prop in what) {
            args.push(prop);
            args.push(what[prop]);
        }

        // console.log('spawn(', toolPath, args, ')');
        var tool = spawn(toolPath, args);

        var password = '';
        tool.stdout.on('data', function(d) {
            password += d;
        });

        var out = Q.defer();
        tool.on('close', function(code /* , signal */) {
            if (code !== 0) {
                out.reject(new Error('non-zero exit from ' + toolPath));
                return;
            }

            out.resolve(password);
        });

        return out.promise;
    }

    return lookup;
}


function makeWithConnection(mysql, opts) {
    function withConnection(fn) {
        var connection = mysql.createConnection(opts);
        connection.connect(); // ???
        var out = fn(connection);
        connection.end();  // TODO: pooling?
        return out;
    }

    return withConnection;
}


function getBalance(withConnection) {
    var out = Q.defer();

    withConnection(function(connection) {
        connection.query(
            'SELECT 1 + 1 AS balance',
            function(err, rows, fields) {
                if (err) {
                    out.reject(err);
                    return;
                }
                
                out.resolve(rows[0].balance);
            });
    });

    return out.promise;
} 

integrationTestMain(process.argv,
                    process.env.LOGNAME,
                    require('child_process').spawn,
                    require('mysql'));
