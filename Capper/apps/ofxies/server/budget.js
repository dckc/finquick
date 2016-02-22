/** budget -- Collect transaction info and review/revise budgeted expenses.
 *
 * @flow
 *
 */
/* jshint esversion: 6, node: true */
'use strict';

const Q = require('q');
const docopt = require('docopt').docopt;

const makeSecretTool = require('./secret-tool').makeSecretTool;
const OFX = require('./asOFX').OFX;

const usage = `
Usage:
  budget.js [-h HOST] DB ACCOUNT SINCE

Options:
  -h HOST    database host [default: localhost]
`;

/*::
type Env = {
  argv : Array<string>,
  LOGNAME: string,
  stdout : stream$Writable | tty$WriteStream,
  pid: number,
  hostname: () => string,
  spawn : (command: string, args: Array<string>) => child_process$ChildProcess,
  mkEvents: MySQLEvents,
  mysql : MySql
}
*/

function main(env)
{
    const cli = docopt(usage, { argv: env.argv.slice(2) });

    const optsP = makeSecretTool(env.spawn).lookup({
        protocol: 'mysql',
        server: cli['-h'],
        object: cli.DB
    }).then(password => ({
        host     : cli['-h'],
        user     : env.LOGNAME,
        password : password,
        database : cli.DB
    }));

    const db = makeDB(env.mysql, env.mkEvents,
                      { pid: env.pid, hostname: env.hostname },
                      optsP);

    db.subscribe(`${cli.DB}.splits`, (oldRow, newRow) => {
        console.log('old: ', oldRow,
                    'new:', newRow);
    });

    const chart = makeChartOfAccounts(db);

    chart.getLedger(cli.ACCOUNT, cli.SINCE).then(
        info => env.stdout.write(`ledger: ${info}\n`)
    ).done();
    chart.acctBalance(cli.ACCOUNT, cli.SINCE).then(
        info => env.stdout.write(`balance: ${info.balance}\n`)
    )
        .then(() => db.end())
        .done();
}


/*::

// TODO: pass 'stmttrn' table name in to makeDB?

type DB = {
    query<T>(dml: string, t: T, params?: Array<any>): Promise<T>;
    begin(): Promise<Transaction>;
    withOFX<T>(acctCode: string, remoteTxns: Array<STMTTRN>,
               action: () => Promise<T>): Promise<T>;
    // TODO: return unsubscribe thingy
    subscribe(path: string, handler: (oldRow: any, newRow: any) => void): void;
    end(): void
}

type STMTTRN = any; // TODO

type Transaction = {
    update<T>(dml: string, t: T, params?: Array<any>): Promise<T>;
    commit(): Promise<{}>;
    rollback(): Promise<{}>;
}

// TODO: annotate mkEvents

*/

function makeDB(mysql /*: MySql*/, mkEvents /*: MySQLEvents*/,
                proc /*: { pid: number, hostname: () => string }*/,
                optsP) /*: DB*/ {
    const connP = optsP.then(opts => mysql.createConnection(opts));

    function exec/*:: <T>*/(dml /*: string*/, _outType /*: T*/,
                         params /*: ?Array<any>*/) /*: Promise<T>*/{
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

    function subscribe(path, handler) {
        optsP.then(opts => {
            const watcher = mkEvents(opts);
            watcher.add(path, handler);
        });
    }

    function begin() /*: Promise<Transaction> */ {
        const mkTx = _r => Object.freeze({
            update: exec,
            commit: () => exec('commit', {})
                .then(_r => exec('delete from gnclock', {})),
            rollback: () => exec('rollback', {})
                .then(_r => exec('delete from gnclock', {}))
        });

        return exec('select hostname, pid from gnclock',
                    [{hostname: '', pid: 0}])
            .then(locks => {
                if (locks.length > 0) {
                    console.log('locked!', locks);
                    const l = locks[0];
                    const p = `process ${l.pid} on ${l.hostname}`;
                    return optsP.then(opts => {
                        throw `Database ${opts.database} locked by ${p}`;
                    });
                }

                return exec(`insert into gnclock (Hostname, Pid)
                            values (?, ?)`, null, [proc.hostname(), proc.pid])
                    .then(_result => exec('begin', null))
                    .then(mkTx);
            });
    }

    function withOFX/*:: <T>*/(acctCode, remoteTxns,
                               action /*: () => Promise<T>*/)
                  /*: Promise<T>*/ {
        const createTemp = `
          create table if not exists stmttrn (
            fitid varchar(80),
            checknum varchar(80),
            dtposted datetime not null,
            dtuser datetime,
            memo varchar(80),
            name varchar(80) not null,
            trnamt decimal(7, 2) not null,
            trntype enum ('CREDIT', 'DEBIT'),
            tx_guid varchar(32),
            credit_guid varchar(32),
            debit_guid varchar(32)
          )`;
        const insertRemote = `
          insert into stmttrn (
            trntype, checknum, dtposted, dtuser, fitid
          , trnamt, name, memo) values ? `;
        const varchar = v => v ? v[0] : null;
        const date = v => v ? OFX.parseDate(v[0]) : null;
        const num = v => v ? Number(v[0]) : null;
        const txValues = remoteTxns.map(trn => [
            varchar(trn.TRNTYPE),
            varchar(trn.CHECKNUM),
            date(trn.DTPOSTED),
            date(trn.DTUSER),
            varchar(trn.FITID),
            // REFNUM?
            num(trn.TRNAMT),
            varchar(trn.NAME),
            varchar(trn.MEMO)
        ]);

        const matchByFid = `
          update stmttrn ofx
          join (
           select s.guid slot_guid, fid.string_val fitid
           from accounts acct
           join splits s on s.account_guid = acct.guid
           join slots fid on fid.obj_guid = s.guid
           where fid.name = 'online_id'
           and acct.code = ?
          ) gc on gc.fitid = ofx.fitid
          set credit_guid = slot_guid
        `;

        const genIds = `
          update stmttrn
          set tx_guid = replace(uuid(), '-', '')
            , credit_guid = replace(uuid(), '-', '')
            , debit_guid = replace(uuid(), '-', '')
          where credit_guid is null
        `;

        const prepare /*: Promise<{}>*/ = exec(createTemp, {})
            .then(_r => exec('truncate table stmttrn', {}))
            .then(_r => exec(insertRemote, {}, [txValues]))
            .then(_r => exec(matchByFid, {}, [acctCode]))
            .then(_r => exec(genIds, {}));

        // flow thinks there's a type error here, but I can't find it.
        return prepare.then(_r => action());
    }


    return Object.freeze({
        query: exec,
        begin: begin,
        withOFX: withOFX,
        subscribe: subscribe,
        end: err => connP.then(c => c.end(err))
    });
}


function makeChartOfAccounts(db /*:DB*/)
{
    function filterSeen(acctCode, remoteTxns) {
        // console.log('filterSeen:', acctCode, remoteTxns.length);

        const selectNew = `
          select unix_timestamp(ofx.dtposted) * 1000 post_date
             , ofx.name description
             , ofx.checknum
             , ofx.trnamt amount, ofx.memo
             , ofx.fitid fid, ofx.trntype
          from stmttrn ofx
          where tx_guid is not null
        `;
        const rowEx = { post_date: 0, description : '', checknum: '',
                        amount: 1.10, memo: '', fid: '', trntype: ''};
        return db.withOFX(
            acctCode, remoteTxns,
            () => db.query(selectNew, [rowEx], [acctCode]));
    }

    function importRemote(acctCode, remoteTxns) /*: Promise<number> */ {
        const other = '9001';  // Imbalance-USD

        const addTxns = `
          insert into transactions (
            guid, currency_guid, num, post_date, enter_date, description)
          select
              ofx.tx_guid guid
            , (select guid from commodities
               where namespace='CURRENCY' and mnemonic = 'USD') currency_guid
            , ofx.checknum num
            , ofx.dtposted post_date
            , current_timestamp enter_date
            , ofx.name description
          from stmttrn ofx where tx_guid is not null`;

        const addSplits = `
          insert into splits (
             guid, tx_guid, account_guid, memo, action
           , reconcile_state, reconcile_date
           , value_num, value_denom
           , quantity_num, quantity_denom)
          select
              ofx.credit_guid guid
            , ofx.tx_guid
            , (select guid
               from accounts acct
               where acct.code = ?) account_guid
            , ofx.memo
            , '' action
            , 'c' reconcile_state, current_timestamp reconcile_date
            , ofx.trnamt * 100 value_num, 100 value_denom
            , ofx.trnamt * 100 quantity_num, 100 quantity_denom
          from stmttrn ofx where tx_guid is not null

          union all

          select
              ofx.debit_guid guid
            , ofx.tx_guid
            , (select guid
               from accounts acct
               -- Imbalance-USD
               where acct.code = ?) account_guid
            , '' memo
            , '' action
            , 'n' reconcile_state, null reconcile_date
            , - ofx.trnamt * 100 value_num, 100 value_denom
            , - ofx.trnamt * 100 quantity_num, 100 quantity_denom
          from stmttrn ofx where tx_guid is not null`;

        const addSlots = `
          insert into slots (
                 obj_guid, name
               , slot_type, string_val, gdate_val)
          select credit_guid obj_guid
               , 'online_id' name, 4 slot_type, ofx.fitid string_val, null
          from stmttrn ofx where tx_guid is not null

          union all
          select credit_guid obj_guid
              , 'notes' name, 4 slot_type
              , concat('OFX ext. info: |Memo:', ofx.memo) string_val, null
          from stmttrn ofx where tx_guid is not null

          union all
          select credit_guid obj_guid
              , 'date-posted' name, 10 slot_type, null, ofx.dtposted gdate_val
          from stmttrn ofx where tx_guid is not null
        `;

        return db.begin()
            .then(tx => db.withOFX(
                acctCode, remoteTxns,
                () => tx.update(addTxns, {})
                    .then(added => tx.update(addSplits, {}, [acctCode, other])
                          .then(_r => tx.update(addSlots, {}))
                          .then(_r => tx.commit())
                          .then(_r => added.affectedRows))));
    }

    function guids(objs) {
        return objs.map(o => o.guid).map(u => '\'' + u + '\'').join(', ');
    }

    function first/*::<T>*/(rows/*: Array<T>*/) /*: T*/{
        return rows[0];
    }

    function subAccounts(acctP /*: Promise<Account> */) {
        function recur(parents, generations, resolve, reject) {
            const rowEx = { guid: '', name: '' };
            db.query(
                `select child.guid, child.name
                from accounts child
                join accounts parent on child.parent_guid = parent.guid
                where parent.guid in (${guids(parents)})`, [rowEx]
            ).then(
                children => {
                    if (children.length === 0) {
                        const acctIds = [].concat.apply([], generations);
                        resolve(acctIds);
                        return;
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

    function currentAccounts() {
        console.log('computing account balances...');

        const rowEx = { guid: '', code: '', name: '',
                        account_type: '', balance: 1.10 };
        return db.query(
            `
            select cur.*, ofx.latest
            from
            (
                select a.guid, a.code, a.name, a.account_type
                     , sum(value_num / value_denom) balance
                from splits s
                join accounts a on a.guid = s.account_guid
	        where a.code between '1000' and '2199'
                  and a.code not between '1500' and '1999'
 	          and length(a.code) = 4
                  and a.account_type not in ('INCOME', 'EXPENSE')
                  and a.hidden = 0
                group by a.guid
                order by a.code
            ) cur left join (
                select a.guid, unix_timestamp(max(tx.post_date))*1000 latest
                from accounts a
                join splits s on s.account_guid = a.guid
                join slots fid
                  on fid.obj_guid = s.guid
                 and fid.name = 'online_id'
                join transactions tx on s.tx_guid = tx.guid
                group by a.guid
            ) ofx on cur.guid = ofx.guid
            order by cur.code`, [rowEx]);
    }

    function recentTransactions(limit) {
        const splitEx /*: TxSplit */ = {
            post_date: 0, num: '', description: '',
            name: '', reconcile_state: '',
            amount: 1.10, memo: '', tx_guid: '', guid: ''
        };
        return db.query(
            `
            select unix_timestamp(tx.post_date)*1000 post_date
                 , tx.num, tx.description
                 , a.name
                 , s.reconcile_state
                 , s.value_num / s.value_denom amount
                 , s.memo
                 , tx.guid tx_guid
                 , s.guid
            from transactions tx
            join splits s on s.tx_guid = tx.guid
            join accounts a on s.account_guid = a.guid
            order by tx.post_date desc, tx.guid
            limit ?
            `, [splitEx], [limit]);
    }

    /*::
    type AcctBal = {
        balance: number,
        name: string,
        since: Date
    };
     */
    function acctBalance(acctName, since) /*: Promise<AcctBal> */{
        const sinceWhen = parseDate(since);

        const rowEx /*: AcctBal*/ = {
            balance: 1.10, name: '', since: new Date(0)
        };

        return subAccounts(acctByName(acctName)).then(
            accts =>
                db.query(
                    `select sum(value_num / value_denom) balance
                    , ? name, ? since
                    from splits s
                    join accounts a on a.guid = s.account_guid
                    join transactions tx on tx.guid = s.tx_guid
                    where a.guid in (${guids(accts)})
                    and tx.post_date >= ?`, [rowEx],
                    [acctName, sinceWhen, sinceWhen]).then(first)
        );
    }

    /*::
      type TxSplit = {
          post_date: number,
          description: string,
          amount: number,
          memo: string,
          fid?: ?string,
          guid: string,
          tx_guid: string
      }
    */
    function getLedger(acctName, since) /*: Promise<Array<TxSplit>> */ {
        const sinceWhen = parseDate(since);

        const rowEx /*: TxSplit */ = {
            post_date: 0, description: '',
            amount: 1.10, memo: '', fid: '',
            guid: '', tx_guid: ''};

        return acctByName(acctName).then(
            acct =>
                db.query(
                    `select unix_timestamp(tx.post_date) * 1000 post_date
                    , tx.description
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
                    order by tx.post_date desc
                    `, [rowEx], [acct.guid, sinceWhen]));
    }

    function parseDate(ymd) {
        const parts = ymd.split('-').map(s => parseInt(s, 10));
        return new Date(parts[0], parts[1]-1, parts[2]);
    }

    /*::
    type Account = {
        guid: string,
        name: string,
        account_type: string, // TODO: enumeration
        parent_guid: string,
        code: string,
        description: string,
        hidden: number, // TODO: boolean
        placeholder: number
    }
     */
    // KLUDGE: name or code
    function acctByName(acctName) /*: Promise<Account> */ {
        const rowEx /*: Account */= { guid: '', name: '', account_type: '',
                        parent_guid: '', code: '', description: '',
                        hidden: 0, placeholder: 0 };
        return db.query(
            `select guid, name, account_type, parent_guid
                  , code, description, hidden, placeholder
            from accounts where name = ? or code = ?`,
            [rowEx],
            [acctName, acctName])
            .then(first);
    }

    return Object.freeze({
        subAccounts: acctName => subAccounts(acctByName(acctName)),
        acctBalance: acctBalance,
        recentTransactions: recentTransactions,
        getLedger: getLedger,
        filterSeen: filterSeen,
        importRemote: importRemote,
        currentAccounts: currentAccounts,
        destroy: () => db.end()
    });
}

if (require.main === module) {
    main({
        argv: process.argv,
        LOGNAME: process.env.LOGNAME,
        stdout: process.stdout,
        pid: process.pid,
        hostname: require('os').hostname,
        spawn: require('child_process').spawn,
        mkEvents: require('mysql-events'),
        mysql: require('mysql')});
}

// TODO: move mysql decls to lib/mysql.js
/*::
interface MySql {
  createConnection(config: IConnectionConfig): IConnection;
}

type MySQLEvents = any; // TODO

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
