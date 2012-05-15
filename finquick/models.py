'''models -- finquick database access

After we mock up a database session with test data...

>>> (session, ) = Mock.make([KSession])

... we can query for accounts as per the usual sqlalchemy orm API.

Find the root account of the first book::
>>> (rg, ) = session.execute('select root_account_guid from books').fetchone()
>>> rg
u'4b1541673b2df412263bf6888043a6f8'
>>> root = session.query(Account).filter(Account.guid == rg).one()

Our mock data has one bank, under Current Assets, under Assets:

>>> banks = session.query(Account).filter(Account.account_type == 'BANK').all()
>>> banks
... #doctest: +NORMALIZE_WHITESPACE
[Account(guid=u'b49249296b4e626e15e3e9dc26e134ee',
 name=u'Checking Account', account_type=u'BANK',
 description=u'Checking Account', hidden=False,
 placeholder=False, parent_guid=u'8e14dd0122d7603d321cbdc27ad1a61e')]

>>> banks[0].parent.parent.parent is root
True

'''

import uuid
import datetime
import re

import injector
from injector import inject, provides, singleton
from sqlalchemy import (
    Column, ForeignKey,
    Integer, String, Boolean,
    Text, DECIMAL, DATETIME,
    and_, or_
    )
from sqlalchemy.dialects import sqlite
from sqlalchemy import orm, sql, engine, func, create_engine
from sqlalchemy.ext.declarative import declarative_base
from zope.sqlalchemy import ZopeTransactionExtension

from dotdict import dotdict

KSession = injector.Key('Session')
KUUIDGen = injector.Key('UUIDGen')
Base = declarative_base()


class DBConfig(injector.Module):
    '''Provide a transactional session, given an Engine.
    '''
    @singleton
    @provides(KSession)
    @inject(engine=engine.Engine)
    def session(self, engine):
        sm = orm.sessionmaker(extension=ZopeTransactionExtension())
        s = orm.scoped_session(sm)
        s.configure(bind=engine)
        return s

    @singleton
    @provides(KUUIDGen)
    def uuidgen(self):
        return uuid.uuid4

    @classmethod
    def mods(cls):
        '''Instantiate this module and its dependencies.
        '''
        return [cls()]


class GuidMixin(object):
    '''Provide guid primary key as used by many tables in GnuCash.
    '''
    T = String(32)
    guid = Column(T, primary_key=True)

    @classmethod
    def fmt(cls, u):
        '''Compute GnuCash string form from python uuid.

        >>> u = uuid.uuid5(uuid.NAMESPACE_DNS, 'example.org')
        >>> s = GuidMixin.fmt(u)
        >>> '-' in s
        False
        >>> len(s)
        32
        >>> len(s) == GuidMixin.T.length
        True
        '''
        return str(u).replace('-', '')

    def __repr__(self):
        '''Represent orm objects as useful, deterministic strings.

        >>> class T(Base, GuidMixin):
        ...     __tablename__ = 'person'
        ...     name = Column(String)
        >>> T(guid=_n2g('Bob'), name='Bob')
        T(guid='8b415c81c3255b6b975a40e0b5cdb699', name='Bob')
        '''
        cols = self.__class__.__table__.columns
        vals = [(c.name, getattr(self, c.name))
                for c in cols]
        return '%s(%s)' % (self.__class__.__name__,
                           ', '.join(['%s=%s' % (n, repr(v))
                                     for n, v in vals]))


def _n2g(name):
    ns = uuid.NAMESPACE_OID  # a bit of a kludge
    return GuidMixin.fmt(uuid.uuid5(ns, name))


def _json_val(col, x):
    if x is None:
        return x

    cls = col['type'].__class__
    if cls in (String, Text, Integer, Boolean):
        return x
    if cls == DATETIME:
        return x.isoformat()
    elif cls == DECIMAL:
        return str(x)
    else:
        raise NotImplementedError('_json_val? %s / %s' % (x, cls))


def jrec(rec, col_descs):
    return dict([(c['name'], _json_val(c, getattr(rec, c['name'])))
                 for c in col_descs])


class Account(Base, GuidMixin):
    __tablename__ = 'accounts'
    name = Column(String)
    account_type = Column(String)  # should be Enumeration...
    description = Column(Text)
    hidden = Column(Boolean)
    placeholder = Column(Boolean)
    parent_guid = Column(String, ForeignKey('accounts.guid'))

    # Self-join relationships default to one-to-many...  "To establish
    # the relationship as many-to-one, an extra directive is added
    # known as remote_side..."
    #
    # Since guid isn't in local, we exploit: "... remote_side may
    # also be passed as a callable function which is evaluated at
    # mapper initialization time."
    parent = orm.relationship('Account', remote_side=lambda: Account.guid)

    @classmethod
    def summary(cls, session):
        '''Summarize accounts as well as their balances etc.

        Given our mock session, with mock data...

        >>> (session, ) = Mock.make([KSession])

        A summary query returns the following columns:

        >>> q = Account.summary(session)
        >>> [str(d['name']) for d in q.column_descriptions]
        ... # doctest: +NORMALIZE_WHITESPACE
        ['guid', 'name', 'account_type', 'description',
         'hidden', 'placeholder', 'parent_guid',
         'balance', 'reconciled_balance',
         'total_period']

        >>> [(a.name, a.balance, a.reconciled_balance)
        ...  for a in q.order_by(Account.name).all()]
        ... # doctest: +NORMALIZE_WHITESPACE
        [(u'Assets', None, None),
         (u'Checking Account', Decimal('-370.0000000000'), None),
         (u'Current Assets', None, None),
         (u'Equity', None, None),
         (u'Expenses', Decimal('370.0000000000'), None),
         (u'Income', None, None),
         (u'Opening Balances', None, None),
         (u'Root Account', None, None),
         (u'Template Root', None, None)]

        '''

        sum_value = func.sum(Split.value_num / Split.value_denom,
                             type_=DECIMAL)
        def by_acct(q):
            return q.group_by(Split.account_guid).subquery()

        balance = by_acct(session.query(
            Split.account_guid,
            sum_value.label('balance')))

        reconciled = by_acct(session.query(
            Split.account_guid,
            sum_value.label('reconciled_balance'),
            #func.max(Split.reconcile_date, type_=GNC_DateTime).\
            #label('last_reconcile_date')
            ).\
            filter(Split.reconcile_state == 'y'))

        #@@ TODO: real accounting period
        period_start = datetime.datetime(2010, 1, 1)
        in_period = by_acct(session.query(
            Split.account_guid,
            sum_value.label('total_period')).\
            join(Transaction).\
            filter(and_(Split.tx_guid == Transaction.guid,
                        Transaction.post_date > period_start)))

        sq = session.query(Account.guid.label('guid'),
                           Account.name.label('name'),
                           Account.account_type.label('account_type'),
                           Account.description.label('description'),
                           Account.hidden.label('hidden'),
                           Account.placeholder.label('placeholder'),
                           Account.parent_guid.label('parent_guid'),
                           balance.c.balance,
                           reconciled.c.reconciled_balance,
                           #reconciled.c.last_reconcile_date,
                           in_period.c.total_period
                           ).\
            outerjoin(balance, Account.guid == balance.c.account_guid).\
            outerjoin(reconciled, Account.guid == reconciled.c.account_guid).\
            outerjoin(in_period, Account.guid == in_period.c.account_guid)

        return sq

GNC_DATETIME_RE = re.compile(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})")
#GNC_DateTime = sqlite.DATETIME(
#        storage_format='%04d%02d%02d%02d%02d%02d%0d',
#        regexp=GNC_DATETIME_RE
#        )
_SDT = sqlite.DATETIME(
    storage_format='%04d%02d%02d%02d%02d%02d%0d',
    regexp=GNC_DATETIME_RE
    )
# KLUDGE! adapt() seems to rely on attribute names
_SDT.regexp = GNC_DATETIME_RE
_SDT.storage_format = '%04d%02d%02d%02d%02d%02d%0d'
GNC_DateTime = DATETIME().with_variant(_SDT, 'sqlite')


def _test_gnc_datetime():
    '''
    >>> m = GNC_DATETIME_RE.match(u'20110501045959')
    >>> datetime.datetime(*map(int, m.groups(0)))
    datetime.datetime(2011, 5, 1, 4, 59, 59)
    '''
    pass


class Transaction(Base, GuidMixin):
    __tablename__ = 'transactions'
    currency_guid = Column(String)
    num = Column(String)
    post_date = Column(GNC_DateTime)
    enter_date = Column(GNC_DateTime)
    description = Column(String)
    splits = orm.relationship('Split')

    @classmethod
    def search_query(cls, session, txt=None, account=None, amount=None):
        '''Find transactions by text search in description/memo.

        Given our mock session, with mock data...

        >>> (session, ) = Mock.make([KSession])

        A search query returns the following columns:

        >>> q = Transaction.search_query(session, 'Electric')
        >>> [d['name'] for d in q.column_descriptions]
        ... # doctest: +NORMALIZE_WHITESPACE
        ['post_date', 'description', 'split_guid', 'tx_guid',
         'account_guid', 'account_name', 'account_type', 'memo',
         'value_num', 'value_denom']

        Our test data has one transaction with `Electric` in the description:

        >>> rows = q.all()
        >>> [(r.account_name, r.value_num / r.value_denom) for r in rows]
        [(u'Checking Account', -250), (u'Expenses', 250)]
        >>> len(set([row.tx_guid for row in rows]))
        1

        We can find the same transaction by matching a split memo:
        >>> split_matches = Transaction.search_query(session, 'killowatt')
        >>> split_matches[0].tx_guid == rows[0].tx_guid
        True

        Or by amount:
        >>> amt_q = Transaction.search_query(session, amount=250)
        >>> [(r.account_name, r.value_num / r.value_denom) for r in amt_q.all()]
        [(u'Checking Account', -250), (u'Expenses', 250)]


        Or by account:
        >>> amt_q = Transaction.search_query(session, account='Expenses')
        >>> [(r.account_name, r.value_num / r.value_denom) for r in amt_q.all()]
        ... #doctest: +NORMALIZE_WHITESPACE
        [(u'Checking Account', -60), (u'Expenses', 60),
         (u'Checking Account', -60), (u'Expenses', 60),
         (u'Checking Account', -250), (u'Expenses', 250)]

        Or by all of the above:
        >>> amt_q = Transaction.search_query(session,
        ...                                  txt='Electric',
        ...                                  amount=250,
        ...                                  account='Expenses')
        >>> [(r.account_name, r.value_num / r.value_denom) for r in amt_q.all()]
        [(u'Checking Account', -250), (u'Expenses', 250)]
        '''

        detail = session.query(Transaction.post_date.label('post_date'),
                               Transaction.description.label('description'),
                               Split.guid.label('split_guid'),
                               Split.tx_guid.label('tx_guid'),
                               Split.account_guid.label('account_guid'),
                               Account.name.label('account_name'),
                               Account.account_type.label('account_type'),
                               Split.memo.label('memo'),
                               Split.value_num.label('value_num'),
                               Split.value_denom.label('value_denom')).filter(
            and_(Split.tx_guid == Transaction.guid,
                 Split.account_guid == Account.guid))

        tx_crit = []  # any of these
        split_crit = []  # all of these
        
        if txt:
            pattern = '%' + txt + '%'
            tx_crit.append(Transaction.description.like(pattern))
            split_crit.append(Split.memo.like(pattern))

        if amount:
            split_crit.append(Split.value_num == amount * Split.value_denom)

        if account:
            split_crit.append(sql.exists(
                [Account.guid],
                and_(Split.account_guid == Account.guid,
                     Account.name == account)))

        if split_crit:
            tx_crit.append(
                sql.exists([Split.guid],
                           and_(*([Split.tx_guid == Transaction.guid] +
                                  split_crit)
                                )).correlate(Transaction.__table__))
        if tx_crit:
            detail = detail.filter(or_(*tx_crit))
            
        return detail.order_by(Transaction.post_date.desc(), Transaction.guid,
                               Account.account_type, Split.guid)


class Split(Base, GuidMixin):
    __tablename__ = 'splits'
    tx_guid = Column(String, ForeignKey('transactions.guid'))
    transaction = orm.relationship('Transaction')
    account_guid = Column(String, ForeignKey('accounts.guid'))
    account = orm.relationship('Account')
    memo = Column(String)
    action = Column(String)
    reconcile_state = Column(String)
    reconcile_date = Column(GNC_DateTime)
    value_num = Column(Integer)
    value_denom = Column(Integer)
    # TODO: derive value, a decimal
    quantity_num = Column(Integer)
    quantity_denom = Column(Integer)
    #lot_guid = Column(String)


class Slot(Base):
    __tablename__ = 'slots'
    id = Column(Integer, primary_key=True)
    obj_guid = Column(String(32))
    name = Column(String(4096))
    slot_type = Column(Integer)
    __mapper_args__ = {'polymorphic_on': slot_type}


class TextSlot(Slot):
    __mapper_args__ = {'polymorphic_identity': 4}
    string_val = Column(String(4096))


class GuidSlot(Slot):
    __mapper_args__ = {'polymorphic_identity': 9}
    guid_val = Column(String(32))


class Mock(injector.Module):
    @classmethod
    def make(cls, what):
        mods = [cls()] + DBConfig.mods()
        depgraph = injector.Injector(mods)
        return [depgraph.get(it) if it else depgraph
                for it in what]

    @singleton
    @provides(engine.Engine)
    def engine_with_mock_data(self, url='sqlite:///'):
        engine = create_engine(url)
        self.bootstrap(engine)
        return engine

    sql='test/fin1.sql'
    def bootstrap(self, engine):
        import pkg_resources
        for line in pkg_resources.resource_stream(__name__, self.sql):
            stmt = line.strip().strip(';')
            if stmt == 'COMMIT':
                continue  # avoid 'no transaction is active'
            engine.execute(stmt)
