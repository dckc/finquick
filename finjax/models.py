'''models -- finjax database access
'''

import injector
from injector import inject, provides, singleton
import sqlalchemy
from sqlalchemy import (
    Column, ForeignKey,
    Integer, String, Boolean,
    Date, Text,
    and_, or_
    )
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.sql import exists
from zope.sqlalchemy import ZopeTransactionExtension

SessionMaker = sessionmaker(extension=ZopeTransactionExtension())
KSessionMaker = injector.Key('SessionMaker')
Base = declarative_base()


class DBConfig(injector.Module):
    @singleton
    @provides(KSessionMaker)
    @inject(engine=sqlalchemy.engine.Engine)
    def session_maker(self, engine):
        sm = scoped_session(SessionMaker)
        sm.configure(bind=engine)
        return sm

    @classmethod
    def mods(cls):
        return [cls()]


class GuidMixin(object):
    guid = Column(String, primary_key=True)


class Account(Base, GuidMixin):
    __tablename__ = 'accounts'
    name = Column(String)
    account_type = Column(String)  # should be Enumeration...
    parent_guid = Column(String, ForeignKey('accounts.guid'))
    parent = orm.relationship('Account')
    description = Column(Text)
    hidden = Column(Boolean)
    placeholder = Column(Boolean)


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
                exists([Split.guid],
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
    action = Column(String)
    reconcile_state = Column(String)
    reconcile_date = Column(Date)
    value_num = Column(Integer)
    value_denom = Column(Integer)
    # TODO: derive value, a decimal
    quantity_num = Column(Integer)
    quantity_denom = Column(Integer)
    lot_guid = Column(String)


def _fix_date(col, x):
    if x and col['type'].__class__ == Date:
        return x.isoformat()
    else:
        return x

def jrec(rec, col_descs):
    return dict([(c['name'], _fix_date(c, getattr(rec, c['name'])))
                 for c in col_descs])
