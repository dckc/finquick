'''
>>> import pkg_resources
>>> ofxin = pkg_resources.resource_stream(__name__, 'test/test_ofx.ofx')

>>> p = OFXParser()
>>> list(p.header(ofxin))
... #doctest: +NORMALIZE_WHITESPACE
[('OFXHEADER', '100'), ('DATA', 'OFXSGML'), ('VERSION', '102'),
 ('SECURITY', 'NONE'), ('ENCODING', 'USASCII'),
 ('CHARSET', '1252'), ('COMPRESSION', 'NONE'),
 ('OLDFILEUID', 'NONE'), ('NEWFILEUID', 'NONE')]

.. todo:: decode according to charset

>>> body = ''.join([line for line in ofxin])
>>> p.feed(body)
>>> p.root.tag
'ofx'

>>> len(p.root.findall('.//stmttrn'))
2

>>> [field.tag for field in p.root.find('.//stmttrn')]
... #doctest: +NORMALIZE_WHITESPACE
['trntype', 'dtposted', 'trnamt', 'fitid', 'name',
 'checknum', 'payeeid', 'memo']

>>> [(t.fitid, t.trnamt, t.dtposted)
...  for t in [dotelt(e) for e in p.root.findall('.//stmttrn')]]
[('2-6', '60.00', '20110117212742'), ('2-9', '60.00', '20110117221215')]


### from xml.etree.ElementTree import tostring
### print tostring(p.root)

    >>> import pprint
    >>> pprint.pprint(p.summary())
    {'acctid': '123456789',
     'bankid': '123456789',
     'dtserver': datetime.datetime(2011, 1, 17, 22, 12, 51),
     'fid': None,
     'org': 'Bank of America'}

    >>> pprint.pprint(list(p.transactions()))
    [{'checknum': '2-6',
      'dtposted': datetime.datetime(2011, 1, 17, 21, 27, 42),
      'fitid': '2-6',
      'memo': None,
      'name': 'Jared Fetter',
      'payeeid': '2',
      'trnamt': Decimal('60.00'),
      'trntype': 'CREDIT'},
     {'checknum': '2-9',
      'dtposted': datetime.datetime(2011, 1, 17, 22, 12, 15),
      'fitid': '2-9',
      'memo': None,
      'name': 'Jared Fetter',
      'payeeid': '2',
      'trnamt': Decimal('60.00'),
      'trntype': 'CREDIT'}]

>>> logging.basicConfig(level=logging.DEBUG)
>>> logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
>>> (session, i) = models.Mock.make([models.KSession, Importer])
>>> from models import Account
>>> bank = session.query(Account).filter(Account.name == 'Bank X').one()
>>> i.run(p.summary(), p.transactions(), bank, '@@')

'''

from xml.etree.ElementTree import Element
from decimal import Decimal
import datetime
import logging
import re
import sgmllib  # Note: deprecated

from injector import inject
from sqlalchemy import Column, and_
from sqlalchemy.types import String, DECIMAL, DATETIME

import models

log = logging.getLogger(__name__)


class Importer(object):
    @inject(datasource=models.KSession)
    def __init__(self, datasource):
        self._ds = datasource

    def run(self, summary, transactions, acct, txfr):
        '''
        .. todo:: do something with the summary
        '''
        session = self._ds()  # hmm... instantiate this?
        tst = StmtTrn.__table__
        session.execute(tst.insert(),
                        list(transactions))
        ta = models.Account.__table__
        ts = models.Split.__table__
        tsl = models.TextSlot.__table__

        log.debug('acct guid: %s / %s', acct.guid, type(acct.guid))
        online_ids = ts.join(ta).\
            join(tsl, tsl.c.obj_guid == ts.c.guid).\
            select().\
            where(and_(tsl.c.name == 'online_id',
                       ta.c.guid == acct.guid))
        novel = tst.outerjoin(online_ids, tst.c.fitid == tsl.c.string_val).\
            select().with_only_columns(tst.columns).\
            where(tsl.c.string_val == None)
        session.execute(novel)


class StmtTrn(models.Base):
    '''Temporary table for OFX import.
    '''
    __tablename__ = 'ofx_stmttrn'
    fitid = Column(String(80), primary_key=True)
    checknum = Column(String(80))
    dtposted = Column(DATETIME)
    memo = Column(String(80))
    name = Column(String(80))
    payeeid = Column(String(80))
    trnamt = Column(DECIMAL(precision=8, scale=2))
    trntype = Column(String(80))  # todo: enum 'CREDIT', ...
    

class OFXParser(sgmllib.SGMLParser):
    '''
    .. todo:: parser to take a list of tags that should be collected,
              with corredponding callbacks. (also: look into monads
              vs callbacks). yield tablename, record
    '''

    @classmethod
    def header(self, lines):
        for line in lines:
            if not line.strip():
                break
            n, v = line.strip().split(':', 1)
            yield n, v

    def __init__(self):
        sgmllib.SGMLParser.__init__(self)
        self._data = []
        self.root = None
        self._ancestors = []

    def unknown_starttag(self, tag, attributes):
        debugstack = [a.tag for a in self._ancestors]
        log.debug('tag: %s in %s', tag, debugstack)

        if self.root is not None:
            text = ''.join(self._data).strip()
            if text:
                current = self._ancestors[-1]
                current.text = text
                self._ancestors.pop()

        self._data = []

        start = Element(tag, dict(attributes))
        if self.root is None:
            self.root = start
        else:
            parent = self._ancestors[-1]
            parent.append(start)

        self._ancestors.append(start)

    def unknown_endtag(self, tag):
        self._ancestors.pop()

    def handle_data(self, data):
        self._data.append(data)

    def summary(self):
        root = self.root
        assert(root is not None)  # ugh... hardly functional

        status = dotelt(self.root.find('.//status'))
        if status.code != '0':
            raise ValueError((status.code, status.severity))

        fi = dotelt(self.root.find('.//fi'))

        acct = dotelt(_or(self.root.find('.//bankacctfrom'),
                          self.root.find('.//ccacctfrom')))
        return dict(dtserver=self.parse_date(root.find('.//dtserver').text),
                    org=fi.org,
                    fid=fi.fid,
                    acctid=acct.acctid,
                    bankid=acct.get('bankid'))

    def transactions(self):
        root = self.root
        assert(root is not None)  # ugh... hardly functional
        for e in root.findall('.//stmttrn'):
            tx = dotelt(e)
            yield dict(fitid=tx.fitid,
                       dtposted=self.parse_date(tx.dtposted),
                       checknum=tx.get('checknum'),
                       trntype=tx.trntype,
                       trnamt=Decimal(tx.trnamt),
                       name=tx.name,
                       payeeid=tx.get('payeeid'),
                       memo=tx.get('memo'))

    @classmethod
    def parse_date(cls, txt):
        '''
        >>> OFXParser.parse_date('20120423201548.648[-4:EDT]')
        datetime.datetime(2012, 4, 23, 20, 15, 48, 648000, tzinfo=[-4:EDT])
        '''
        m = re.match(r'(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})'
                     r'(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})'
                     r'(?:\.(?P<frac>\d+))?'
                     r'(?:\[(?P<tzoff>-?\d+):(?P<tzname>\w+)\])?',
                     txt)
        if not m:
            raise ValueError(txt)
        year, month, day, hour, minute, second = [
            int(m.group(part)) for part in
            'year month day hour minute second'.split()]

        fractxt = m.group('frac')
        frac = int(fractxt) * 10 ** (6 - len(fractxt)) if fractxt else 0
        tzofftxt = m.group('tzoff')
        if tzofftxt:
            tz = FixedOffset(int(tzofftxt), m.group('tzname'))
        else:
            tz = None
        return datetime.datetime(year, month, day, hour, minute, second,
                                 frac, tz)


def _or(e1, e2):
    return e1 if e1 is not None else e2

class FixedOffset(datetime.tzinfo):
# ack: http://docs.python.org/library/datetime.html#tzinfo-objects
    """Fixed offset in hours east from UTC."""

    def __init__(self, offset, name):
        self._hrs = offset
        self.__offset = datetime.timedelta(minutes = offset * 60)
        self.__name = name

    def __repr__(self):
        return '[%d:%s]' % (self._hrs, self.__name)

    def utcoffset(self, dt):
        return self.__offset

    def tzname(self, dt):
        return self.__name

    def dst(self, dt):
        return ZERO

ZERO = datetime.timedelta(0)


class dotelt(object):
    def __init__(self, e):
        self.e = e

    def __getattr__(self, n):
        ch = self.e.find(n)
        if ch is None:
            raise AttributeError(n)
        return ch.text

    def get(self, n, default=None):
        ch = self.e.find(n)
        return ch.text if ch is not None else default


if __name__ == '__main__':
    import doctest
    doctest.testmod()
