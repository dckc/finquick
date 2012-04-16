from sqlalchemy import (
    Column, ForeignKey,
    Integer, String, Boolean,
    Date, Text,
    )
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker
from zope.sqlalchemy import ZopeTransactionExtension

SessionMaker = sessionmaker(extension=ZopeTransactionExtension())
Base = declarative_base()


def make_session():
    return scoped_session(SessionMaker)


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
    if x and col.type.__class__ == Date:
        return x.isoformat()
    else:
        return x

def jrec(rec, cols):
    return dict([(c.name, _fix_date(c, getattr(rec, c.name)))
                 for c in cols])
