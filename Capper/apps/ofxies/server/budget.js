/** budget -- Collect transaction info and review/revise budgeted expenses.
 *
 * @flow
 */
'use strict';

const Q = require('q');

const makeSecretTool = require('./secret-tool').makeSecretTool;
const OFX = require('./asOFX').OFX;

function integrationTestMain(
    argv /*: Array<string>*/,
    env /*:any*/,
    stdout /*: stream$Writable | tty$WriteStream */,
    spawn /*: (command: string, args: Array<string>) =>
            child_process$ChildProcess */,
    mysql /*: MySql */)
{
    const
        dbName = argv[2], host = 'localhost',
        acctName = argv[3], since = argv[4];

    const optsP = makeSecretTool(spawn).lookup({
        protocol: 'mysql',
        server: host,
        object: dbName
    }).then(password => ({
        host     : host,
        user     : env.LOGNAME,
        password : password,
        database : dbName
    }));
    const db = makeDB(mysql, optsP);

    const chart = makeChartOfAccounts(db);

    chart.getLedger(acctName, since).then(
        info => stdout.write(`ledger: ${info}\n`)
    ).done();
    chart.acctBalance(acctName, since).then(
        info => stdout.write(`balance: ${info.balance}\n`)
    )
        .then(() => db.end())
        .done();
}


/*::
type DB = {
    query(dml: string, params?: Array<any>): Promise<Array<Object>>;
    update(dml: string, params?: Array<any>): Promise<Array<Object>>;
    end(): void
}

*/

function makeDB(mysql /*: MySql*/, optsP) /*: DB*/ {
    const connP = optsP.then(opts => mysql.createConnection(opts));

    function statement(dml, params) /*: Promise<Array<Object>>*/{
        return connP.then(c => {
            // console.log('DEBUG: db.query: ', dml, params || '');

            // This seems like the Q.ninvoke pattern, but I'm struggling...
            return Q.promise(
                (resolve, reject) =>
                    c.query(dml, params, (err, rows) => {
                        if (err) {
                            // console.log('SQL error: ',
                            //             c.format(dml, params));
                            return reject(err);
                        }
                        // console.log('DEBUG: db.query result: ',
                        //             dml, params, rows);
                        resolve(rows);
                    }));
        });
    }

    return Object.freeze({
        query: statement,
        update: statement,
        end: err => connP.then(c => c.end(err))
    });
}


function makeChartOfAccounts(db /*:DB*/)
{
    function filterSeen(acctCode, remoteTxns) {
        console.log('@@filterSeen:', acctCode, remoteTxns.length);

        const createTemp = `
          create temporary table stmttrn (
            fitid varchar(80),
            checknum varchar(80),
            dtposted datetime not null,
            dtuser datetime,
            memo varchar(80),
            name varchar(80) not null,
            trnamt decimal(7, 2) not null,
            trntype enum ('CREDIT', 'DEBIT'),
            match_guid varchar(32)
          )`;
        const insertRemote = `
          insert into stmttrn (
            trntype, dtposted, dtuser, fitid
          , trnamt, name, memo) values ? `;
        const varchar = v => v ? v[0] : null;
        const date = v => v ? OFX.parseDate(v[0]) : null;
        const num = v => v ? Number(v[0]) : null;
        const txValues = remoteTxns.map(trn => [
            varchar(trn.TRNTYPE),
            date(trn.DTPOSTED),
            date(trn.DTUSER),
            varchar(trn.FITID),
            // REFNUM?
            num(trn.TRNAMT),
            varchar(trn.NAME),
            varchar(trn.MEMO)
        ]);

        const selectNew = `
        select '' + ofx.dtposted post_date, ofx.name description
             , ofx.trnamt amount, ofx.memo
             , ofx.fitid fid, null guid, null tx_guid
        from stmttrn ofx
        left join (
          select s.guid, fitid.string_val fitid
          from splits s
          join slots fitid
            on fitid.obj_guid = s.guid
          join accounts a
            on a.guid = s.account_guid
          where fitid.name = 'online_id' and a.code = ?
        ) gc on gc.fitid = ofx.fitid
        where gc.fitid is null
          and ofx.trnamt != 0
        order by ofx.dtposted `;

        // begin?
        return db.update('drop table if exists stmttrn')
            .then(() => db.update(createTemp))
            .then(() => db.update(insertRemote, [txValues]))
            .then(() => db.query(selectNew, [acctCode]));
    }

    function guids(objs) {
        return objs.map(o => o.guid).map(u => '\'' + u + '\'').join(', ');
    }

    function first(rows) {
        return rows[0];
    }

    function subAccounts(acctP) {
        function recur(parents, generations, resolve, reject) {
            db.query(
                `select child.guid, child.name
                from accounts child
                join accounts parent on child.parent_guid = parent.guid
                where parent.guid in (${guids(parents)})`
            ).then(
                children => {
                    if (children.length == 0) {
                        const acctIds = [].concat.apply([], generations);
                        return resolve(acctIds);
                    }
                    generations.push(children);
                    recur(children, generations, resolve, reject);
                }, reject);
        }

        return Q.promise(
            (resolve, reject) =>
                acctP.then(acct => recur([acct], [[acct]], resolve, reject),
                           reject)
        );
    }

    function onlineStatus() {
	return db.query(`
            select ofx.*, bal.balance
            from (
              select a.guid, unix_timestamp(max(tx.post_date))*1000 latest,
                     a.code, a.name, a.account_type
              from accounts a
              join splits s on s.account_guid = a.guid
              join slots fid on fid.obj_guid = s.guid and fid.name = 'online_id'
              join transactions tx on s.tx_guid = tx.guid
              where a.hidden = 0
              group by a.guid, a.name
            ) ofx join (
              select a.guid, sum(value_num / value_denom) balance
              from splits s
              join accounts a on a.guid = s.account_guid
              join transactions tx on tx.guid = s.tx_guid
              group by a.guid
            ) bal on bal.guid = ofx.guid
            order by ofx.latest`);
    }

    function acctBalance(acctName, since) {
        const sinceWhen = parseDate(since);
        return subAccounts(acctByName(acctName)).then(
            accts =>
                db.query(
                    `select sum(value_num / value_denom) balance
                    , ? name, ? since
                    from splits s
                    join accounts a on a.guid = s.account_guid
                    join transactions tx on tx.guid = s.tx_guid
                    where a.guid in (${guids(accts)})
                    and tx.post_date >= ?`,
                    [acctName, sinceWhen, sinceWhen]).then(first)
        );
    }

    function getLedger(acctName, since) {
        const sinceWhen = parseDate(since);
        return acctByName(acctName).then(
            acct =>
                db.query(
                    `select '' + tx.post_date post_date, tx.description
                    , s.value_num / s.value_denom amount
                    , s.memo
                    , fid.string_val fid
                    , s.guid, s.tx_guid
                    from splits s
                    join transactions tx on tx.guid = s.tx_guid
                    join accounts sa on sa.guid = s.account_guid
                    left join slots fid on fid.obj_guid = s.guid
                                       and fid.name = 'online_id'
                    where sa.guid = ?
                      and tx.post_date > ?
                    order by tx.post_date desc`, [acct.guid, sinceWhen]));
    }

    function parseDate(ymd) {
        const parts = ymd.split('-').map(s => parseInt(s, 10));
        return new Date(parts[0], parts[1]-1, parts[2]);
    }

    // KLUDGE: name or code
    function acctByName(acctName) {
        return db.query(
            `select guid, name, account_type, parent_guid
                  , code, description, hidden, placeholder
             from accounts where name = ? or code = ?`,
            [acctName, acctName])
            .then(first);
    }

    return Object.freeze({
        subAccounts: acctName => subAccounts(acctByName(acctName)),
        acctBalance: acctBalance,
        getLedger: getLedger,
        filterSeen: filterSeen,
        onlineStatus: onlineStatus,
        destroy: () => db.end()
    });
}

if (process.env.TESTING) {
    integrationTestMain(
        process.argv,
        process.env,
        process.stdout,
        require('child_process').spawn,
        require('mysql'));
}

// TODO: move mysql decls to lib/mysql.js
/*::
interface MySql {
  createConnection(config: IConnectionConfig): IConnection;
}


interface IConnection {
    query(sql: string,
          values?: Array<any>,
          callback?: (err: IError, rows: Array<Array<any>>) => void): IQuery;
};

interface IError {};
interface IQuery {};

interface IConnectionOptions {
    user?: string;
    password?: string;
    database?: string;
    charset?: string;
};

interface IConnectionConfig extends IConnectionOptions {
    host?: string;
    port?: number;
};
*/

exports.makeDB = makeDB;
exports.makeChartOfAccounts = makeChartOfAccounts;
