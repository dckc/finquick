/** budget -- Collect transaction info and review/revise budgeted expenses.
 *
 * @flow
 *
 */
/* jshint esversion: 6, node: true */
/*eslint-disable no-console*/
'use strict';

const Q = require('q');
/*:: import type {Promise} from 'q' */
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
        info => env.stdout.write(`ledger: ${info.toString()}\n`)
    ).done();
    chart.acctBalance(cli.ACCOUNT, cli.SINCE).then(
        info => env.stdout.write(`balance: ${info.balance}\n`)
    )
        .then(() => db.end())
        .done();
}


/*::

// TODO: pass 'stmttrn' table name in to makeDB?

import type {STMTTRN} from './asOFX';

type DB = {
    query<T>(dml: string, t: T, params?: Array<any>): Promise<T>;
    begin(): Promise<Transaction>;
    withOFX<T>(acctCode: string, remoteTxns: Array<STMTTRN>,
               action: () => Promise<T>): Promise<T>;
    // TODO: return unsubscribe thingy
    subscribe(path: string, handler: (oldRow: any, newRow: any) => void): void;
    end(): void
}

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
    let connP = reconnect();
    function reconnect() {
        return optsP.then(opts => {
            const conn = mysql.createConnection(opts);
            conn.on('error', err => {
                console.log(err);
                connP = reconnect();
            });
            return conn;
        });
    }

    function exec/*:: <T>*/(dml /*: string*/, _outType /*: T*/,
                         params /*: ?Array<any>*/) /*: Promise<T>*/{
        return connP.then(c => {
            // console.log('DEBUG: db.query: ', dml, params || '');

            // This seems like the Q.ninvoke pattern, but I'm struggling...
            return Q.promise(
                (resolve, reject) =>
                    c.query(dml, params, (err, rows) => {
                        if (err) {
                            console.log('SQL error: ',
                                        c.format(dml, params));
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
        const rollback = () => exec('rollback', {})
              .then(_r => exec('delete from gnclock', {}));
        const mkTx = _r => Object.freeze({
            update: (d, o, p) => exec(d, o, p).catch(error => {
                rollback();
                throw error;
            }),
            commit: () => exec('commit', {})
                .then(_r => exec('delete from gnclock', {})),
            rollback: rollback
        });

        return exec('select hostname, pid from gnclock',
                    [{hostname: '', pid: 0}])
            .then(locks => {
                if (locks.length > 0) {
                    console.log('locked!', locks, 'we are', proc.pid);
                    const l = locks[0];
                    if (l.pid === proc.pid) {
                        return Q(mkTx);
                    }
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
                    /*: Promise<T>*/
    {
        const createTemp = `
          create table if not exists stmttrn (
            fitid varchar(80),
            checknum varchar(80) not null,
            dtposted datetime not null,
            dtuser datetime,
            memo varchar(1024),
            name varchar(80) not null,
            trnamt decimal(7, 2) not null,
            trntype enum ('CREDIT', 'DEBIT', 'CHECK'),
            tx_guid varchar(32),
            credit_guid varchar(32),
            debit_guid varchar(32),
            fitid_slot enum ('Y', 'N')
          )`;
        const insertRemote = `
          insert into stmttrn (
            trntype, checknum, dtposted, dtuser, fitid
          , trnamt, name, memo) values ? `;
        const varchar = v => v ? v : '';
        const varcharOpt = v => v;
        const date = v => v ? OFX.parseDate(v) : null;
        const num = v => v ? Number(v) : null;
        const txValues = remoteTxns.map(trn => [
            varchar(trn.TRNTYPE),
            varchar(trn.CHECKNUM),
            date(trn.DTPOSTED),
            date(trn.DTUSER),
            varchar(trn.FITID),
            // REFNUM?
            num(trn.TRNAMT),
            varcharOpt(trn.NAME),
            varchar(trn.MEMO)
        ]);

        const epoch = { sql: 'select min(dtposted) t0 from stmttrn',
                        ex: {t0: ''}};
        
        const matchByFid = `
          update stmttrn ofx
          join (
           select s.guid slot_guid, fid.string_val fitid
           from accounts acct
           join splits s on s.account_guid = acct.guid
           join transactions tx on s.tx_guid = tx.guid
           join slots fid on fid.obj_guid = s.guid
           where fid.name = 'online_id'
           and acct.code = ?
                  -- optimization: avoid searching all history
           and tx.post_date > adddate(?, interval - 15 day)
          ) gc on gc.fitid = ofx.fitid
          set credit_guid = slot_guid
            , fitid_slot = 'Y'
        `;

        const matchByAmtDate = `
          update stmttrn ofx
          join (
            select tx.post_date
                 , dup.value_num / dup.value_denom amount
                 , dup.guid guid
            from transactions tx
            join splits dup on dup.tx_guid = tx.guid
            join accounts acct on dup.account_guid = acct.guid
            where acct.code = ?
            and tx.post_date > adddate(?, interval - 15 day)
          ) dup on dup.amount = ofx.trnamt
             -- within 72hrs, i.e. 3 days
          and abs(timestampdiff(hour, ofx.dtposted, dup.post_date)) < 72
          set credit_guid = dup.guid
            , fitid_slot = 'N'
          where ofx.credit_guid is null
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
            .then(_r => exec(epoch.sql, epoch.ex))
            .then(agg => exec(matchByFid, {}, [acctCode, agg[0].t0])
                .then(_r => exec(matchByAmtDate, {}, [acctCode, agg[0].t0])))
            .then(_r => exec(genIds, {}));

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
    function filterSeen(acctCode /*: string*/, remoteTxns /*: Array<STMTTRN>*/) /*: Promise<Array<TxSplit>> */{
        // console.log('filterSeen:', acctCode, remoteTxns.length);

        const selectNew = `
          select unix_timestamp(ofx.dtposted) * 1000 post_date
             , ofx.name description
             , ofx.checknum
             , ofx.trnamt amount, ofx.memo
             , ofx.fitid fid, ofx.trntype
             , ofx.fitid_slot
          from stmttrn ofx
          where tx_guid is not null or fitid_slot = 'N'
        `;
        const rowEx = { post_date: 0, description : '', checknum: '',
                        amount: 1.10, memo: '', fid: '', trntype: '',
                        fitid_slot: ''};
        return db.withOFX(
            acctCode, remoteTxns,
            () => db.query(selectNew, [rowEx], [acctCode]));
    }

    function importRemote(acctCode /*: string*/, remoteTxns /*: Array<STMTTRN>*/) /*: Promise<number> */ {
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
          from stmttrn ofx
          where tx_guid is not null
          or fitid_slot = 'N'  -- matched existing split

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

    /*::
    type AccountBalance = {
        guid: string,
        code: string,
        name: string,
        account_type: string,
        balance: number
    };
     */
    function currentAccounts() /*: Promise<Array<AccountBalance>>*/{
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

    function recentTransactions(limit /*: number*/, byAmt /*: ?number */) /*: Promise<Array<TxSplit>> */{
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
            where ? is null or ? = abs(s.value_num / s.value_denom)
            order by tx.post_date desc, tx.guid
            limit ?
                `, [splitEx], [byAmt, byAmt, limit]);
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

    function cashFlow(acct /*: Account*/) {
        console.log('@@cashflow:', acct);
        const q = accts => `
        select year, t, sum(amount) subtot, code, name, guid
        from (
            select year(tx.post_date) year, week(tx.post_date) t
                 , a.guid, a.code, a.name
                 , s.value_num / s.value_denom amount
            from transactions tx
            join splits s on s.tx_guid = tx.guid
            join accounts a on a.guid = s.account_guid
            where tx.post_date >= (
                -- current quarter
                date_add(makedate(year(current_timestamp), 1),
                         interval (quarter(current_timestamp) - 1) * 3 month))
            and a.hidden = 0
            and a.guid in (${guids(accts)})
        )
        ea
        group by year, t, code, name, guid
        order by year, t, code, name, guid
        `;
        const rowEx = { year: 2000, t: 1, subtot: 1.23,
                        code: '1234', name: '', guid: '' };
        return subAccounts(Q(acct))
            .then(accts => db.query(q(accts), rowEx));
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

    /*::
    type AccountId = {
        guid: string,
        name: string,
        code: string,
    }
     */
    function acctSearch(q /*: string*/) /*: Promise<Array<AccountId>>*/{
        const sql = `
        select guid, code, name
        from accounts
        where instr(name, ?) > 0`;
        return db.query(sql, [{guid: '', code: '', name: ''}], [q]);
    }

    return Object.freeze({
        subAccounts: (acctName /*: string*/) => subAccounts(acctByName(acctName)),
        acctSearch: acctSearch,
        acctBalance: acctBalance,
        cashFlow: cashFlow,
        recentTransactions: recentTransactions,
        getLedger: getLedger,
        filterSeen: filterSeen,
        importRemote: importRemote,
        currentAccounts: currentAccounts,
        destroy: () => db.end()
    });
}

if (require.main == module) {
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
    on(evt: string, callback: (err: IError) => void): void;
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
