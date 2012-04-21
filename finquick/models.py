'''models -- finquick database access

After we mock up a database session with test data...

>>> (session, ) = Mock.make([KSession])

... we can query for accounts as per the usual sqlalchemy orm API.

There is always exactly one root account in a GnuCash book.
.. todo:: cite GnuCash spec that says so.

>>> root = session.query(Account).filter(Account.account_type == 'ROOT').one()

Our mock data has one top-level bank:

>>> banks = session.query(Account).filter(Account.account_type == 'BANK').all()
>>> banks
... #doctest: +NORMALIZE_WHITESPACE
[Account(guid=u'a35af99599ef5adbb8e1904b86ae1f26',
 name=u'Bank X', account_type=u'BANK',
 description=u'', hidden=False, placeholder=False,
 parent_guid=u'934e3c4f6aa55a8faedf160686214cc4')]

>>> banks[0].parent is root
True

'''

import uuid
import datetime

import injector
from injector import inject, provides, singleton
from sqlalchemy import (
    Column, ForeignKey,
    Integer, String, Boolean,
    Date, Text,
    and_, or_
    )
from sqlalchemy import orm, sql, engine, create_engine
from sqlalchemy.ext.declarative import declarative_base
from zope.sqlalchemy import ZopeTransactionExtension

from dotdict import dotdict

KSession = injector.Key('Session')
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


class Transaction(Base, GuidMixin):
    __tablename__ = 'transactions'
    currency_guid = Column(String)
    num = Column(String)
    post_date = Column(Date)
    enter_date = Column(Date)
    description = Column(String)
    splits = orm.relationship('Split')

    @classmethod
    def search_query(cls, session, txt):
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
        [(u'Bank X', -250), (u'Utilities', 250)]
        >>> len(set([row.tx_guid for row in rows]))
        1

        We can find the same transaction by matching a split memo:
        >>> split_matches = Transaction.search_query(session, 'killowatt')
        >>> split_matches[0].tx_guid == rows[0].tx_guid
        True

        .. todo:: search by date, account, and amount as well.
        '''

        pattern = '%' + txt + '%'

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

        return detail.filter(
            or_(Transaction.description.like(pattern),
                sql.exists([Split.guid],
                           and_(Split.tx_guid == Transaction.guid,
                                Split.memo.like(pattern))
                           ).correlate(Transaction.__table__))
            ).order_by(Transaction.post_date.desc(), Transaction.guid,
                       Account.account_type, Split.guid)


class Split(Base, GuidMixin):
    __tablename__ = 'splits'
    tx_guid = Column(String, ForeignKey('transactions.guid'))
    transaction = orm.relationship('Transaction')
    account_guid = Column(String, ForeignKey('accounts.guid'))
    account = orm.relationship('Account')
    memo = Column(String)
    #action = Column(String)
    #reconcile_state = Column(String)
    #reconcile_date = Column(Date)
    value_num = Column(Integer)
    value_denom = Column(Integer)
    # TODO: derive value, a decimal
    #quantity_num = Column(Integer)
    #quantity_denom = Column(Integer)
    #lot_guid = Column(String)


def _fix_date(col, x):
    if x and col['type'].__class__ == Date:
        return x.isoformat()
    else:
        return x


def jrec(rec, col_descs):
    return dict([(c['name'], _fix_date(c, getattr(rec, c['name'])))
                 for c in col_descs])


class Mock(injector.Module):
    # TODO: use GnuCash to make a small data set and use CSV files.
    accounts = (dotdict(name='Root Account', account_type='ROOT', parent=None),
                dotdict(name='Bank X', account_type='BANK',
                        parent='Root Account'),
                dotdict(name='Utilities', account_type='EXPENSE',
                        parent='Root Account'))

    transactions = [dotdict(post_date=datetime.datetime(2001, 01, 01, 1, 2, 3),
                            description='Electric company',
                            guid=_n2g('Electric company'))]

    splits = [dotdict(tx_guid=_n2g('Electric company'),
                      account_guid=_n2g('Bank X'),
                      memo='',
                      guid=_n2g(''),
                      value_num=-25000,
                      value_denom=100),
              dotdict(tx_guid=_n2g('Electric company'),
                      account_guid=_n2g('Utilities'),
                      memo='lots o killowatt hours',
                      guid=_n2g('lots o killowatt hours'),
                      value_num=25000,
                      value_denom=100)]

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

    def bootstrap(self, engine):
        Base.metadata.create_all(engine)
        engine.execute(Account.__table__.insert(),
                       self.mock_accounts())
        engine.execute(Transaction.__table__.insert(), self.transactions)
        engine.execute(Split.__table__.insert(), self.splits)

    def mock_accounts(self):
        return [dict(name=acct.name,
                     guid=_n2g(acct.name),
                     account_type=acct.account_type,
                     parent_guid=_n2g(acct.parent) if acct.parent else None,
                     description='',
                     placeholder=False,
                     hidden=False)
                for acct in self.accounts]
