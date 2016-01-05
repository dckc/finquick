const Q = require('q');


function integrationTestMain(process, mysql) {
    'use strict';

    const argv = process.argv,
          dbName = argv[2], host = 'localhost',
          acctName = argv[3], since = argv[4];

    const optsP = makeSecretTool(process.spawn).lookup({
        protocol: 'mysql',
        server: host,
        object: dbName
    }).then(password => ({
        host     : host,
        user     : process.env.LOGNAME,
        password : password,
        database : dbName
    }));
    const db = makeDB(mysql, optsP);
    const budget = makeBudget(db);

    budget.acctBalance(acctName, since).then(
        info => console.log('balance: ', info.balance)
    )
        .then(() => db.end())
        .done();
}


function makeSecretTool(spawn) {
    'use strict';

    // cribbed from https://github.com/drudge/node-keychain/blob/master/keychain.js
    const toolPath = 'secret-tool';

    function lookup(what) {
        const args = ['lookup'];
        for (let prop in what) {
            args.push(prop);
            args.push(what[prop]);
        }


        console.log('spawn(', toolPath, args, ')');
        const tool = spawn(toolPath, args);

        let password = '';
        tool.stdout.on('data', d => { password += d; });

        const out = Q.defer();
        tool.on('close', (code /* , signal */) => {
            if (code !== 0) {
                return out.reject(new Error('non-zero exit from ' + toolPath));
            }

            out.resolve(password);
        });

        return out.promise;
    }

    return Object.freeze({
        lookup: lookup,
        path: () => toolPath
    });
}


function makeDB(mysql, optsP) {
    'use strict';

    const connP = optsP.then(opts => mysql.createConnection(opts));

    function query(dml, params) {
        return connP.then(c => {
            // console.log('DEBUG: db.query: ', dml, params || '');

            // This seems like the Q.ninvoke pattern, but I'm struggling...
            return Q.promise(
                (resolve, reject) =>
                    c.query(dml, params, (err, rows) => {
                        if (err) return reject(err);
                        console.log('DEBUG: db.query result: ', rows);
                        resolve(rows);
                    }));
        });
    }

    return Object.freeze({
        query: query,
        end: err => connP.then(c => c.end(err))
    });
}



function sqlList(uuids) {
    // TODO: verify uuid syntax to prevent against SQL injection
    return uuids.map(u => '\'' + u + '\'').join(', ');
}


function first(rows) {
    return rows[0];
}


function makeBudget(db) {
    'use strict';

    function subAccounts(acctP) {
        const q = ('select child.guid, child.name ' +
                   'from accounts child ' +
                   'join accounts parent on child.parent_guid = parent.guid ' +
                   'where parent.guid in (PARENTS)');

        function recur(parents, generations, resolve, reject) {
            const parentIds = parents.map(p => p.guid);
            db.query(q.replace('PARENTS', sqlList(parentIds))).then(
                children => {
                    if (children.length == 0) {
                        const acctIds = [].concat.apply([], generations);
                        return resolve(acctIds);
                    }
                    generations.push(children);
                    recur(children, generations, resolve, reject);
                }, reject);
        }

        return Q.promise((resolve, reject) => {
            acctP.then(acct => {
                recur([acct], [[acct]], resolve, reject);
            }, reject);
        });
    }

    function acctBalance(acctName, since) {
        const q = ('select sum(value_num / value_denom) balance ' +
                   '  , ? name, ? since ' +
                   'from splits s ' +
                   'join accounts a on a.guid = s.account_guid ' +
                   'join transactions tx on tx.guid = s.tx_guid ' +
                   'where a.guid in (SUBACCOUNTS) ' +
                   'and tx.post_date >= ?');

        return subAccounts(acctByName(acctName)).then(accts => {
            const acctIds = accts.map(a => a.guid);
            return db.query(q.replace('SUBACCOUNTS', sqlList(acctIds)),
                            [acctName, since, since])
                .then(first);
        });
    }

    function acctByName(acctName) {
        return db.query(
            'select guid, name from accounts where name = ?',
            [acctName])
            .then(first);
    }

    return Object.freeze({
        subAccounts: acctName => subAccounts(acctByName(acctName)),
        acctBalance: acctBalance
    });
}


if (process.env.TESTING) {
    integrationTestMain(
        {
            argv: process.argv,
            env: process.env,
            spawn: require('child_process').spawn
        },
        require('mysql'));
}

exports.makeSecretTool = makeSecretTool;
exports.makeDB = makeDB;
