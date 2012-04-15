from sqlalchemy import (
    Column,
    Text,
    String,
    Boolean,
    )

from sqlalchemy.ext.declarative import declarative_base

from sqlalchemy.orm import (
    scoped_session,
    sessionmaker,
    )

from zope.sqlalchemy import ZopeTransactionExtension

SessionMaker = sessionmaker(extension=ZopeTransactionExtension())
Base = declarative_base()


def make_session():
    return scoped_session(SessionMaker)


class GuidMixin(object):
    guid = Column(String, primary_key=True)


class Accounts(Base, GuidMixin):
    __tablename__ = 'accounts'
    name = Column(String)
    account_type = Column(String)  # should be Enumeration...
    parent_guid = Column(String)
    description = Column(Text)
    hidden = Column(Boolean)
    placeholder = Column(Boolean)
