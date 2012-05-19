'''ofxin -- Parse OFX and import with matching by `online_id`.
'''

from xml.etree.ElementTree import Element
from decimal import Decimal
import datetime
import logging
import re
import sgmllib  # Note: deprecated

from injector import inject
from sqlalchemy import Column, and_
from sqlalchemy.types import String, Integer, DATETIME

import models

log = logging.getLogger(__name__)


class Importer(object):
    r'''Import OFX data into GnuCash account using `online_id` matching.

    Consider a simple OFX file with two transactions:
    >>> import pkg_resources
    >>> ofxin = pkg_resources.resource_stream(__name__, 'test/test_ofx.ofx')

    Parse the data:
    >>> summary, transactions_g = OFXParser.ofx_data(ofxin)
    >>> transactions = list(transactions_g)

    Choose the destination account; note splits before import:
    >>> models.Mock.sql='test/fin1_init.sql'
    >>> (session, i) = models.Mock.make([models.KSession, Importer])
    >>> from models import Account, Split

    .. todo:: find account based on online_id

    >>> bank = session.query(Account).\
    ...        filter(Account.name == 'Checking Account').one()
    >>> [split.value_num
    ...  for split in session.query(Split).filter(Split.account == bank)]
    []

    This simple import uses one transfer account for all new transactions:
    >>> exp = session.query(Account).\
    ...        filter(Account.name == 'Expenses').one()

    Insert the transactions into a temporary table and match them
    against existing splits/transactions:
    ### logging.basicConfig(level=logging.INFO)
    ### logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
    >>> _q, matches = i.prepare(summary, transactions, bank)
    >>> len(matches)
    0

    Then import the unmatched transactions and note the results:
    >>> [tx.fitid for tx in  i.execute(bank, exp, summary['curdef'])]
    [u'2-6', u'2-9']
    >>> [split.value_num
    ...  for split in session.query(Split).filter(Split.account == bank)]
    [-6000, -6000]

    Import is idempotent; doing it again has no effect:
    >>> _q, matches = i.prepare(summary, transactions, bank)
    >>> len(matches)
    4
    >>> i.execute(bank, exp, summary['curdef'])
    []
    >>> [split.value_num
    ...  for split in session.query(Split).filter(Split.account == bank)]
    [-6000, -6000]

    '''
    @inject(datasource=models.KSession,
            uuidgen=models.KUUIDGen)
    def __init__(self, datasource, uuidgen):
        self._ds = datasource
        self._uuidgen = uuidgen

    def prepare(self, summary, transactions, acct):
        '''
        .. todo:: do something with the summary
        '''
        session = self._ds()  # hmm... instantiate this?
        tst = StmtTrn.__table__
        tst.drop(bind=session.bind, checkfirst=True)
        tst.create(bind=session.bind)
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
        match_q = tst.join(online_ids, tst.c.fitid == tsl.c.string_val).\
            select().with_only_columns([tst.c.fitid, tsl.c.obj_guid])
        matches = session.execute(match_q).fetchall()
        for fitid, obj_guid in matches:
            session.execute(tst.update().values(match_guid=obj_guid).\
                                where(tst.c.fitid == fitid))
        return match_q, matches

    def execute(self, acct, txfr, currency):
        session = self._ds()  # hmm... instantiate this?
        currency_guid = session.execute('''
            select guid from commodities
            where namespace='CURRENCY' and mnemonic = :currency''',
                                        dict(currency=currency)).fetchone()[0]
        novel = session.query(StmtTrn).\
                filter(StmtTrn.match_guid == None).all()
        for ofxtx in novel:
            fmt = models.GuidMixin.fmt
            tx = models.Transaction(guid=fmt(self._uuidgen()),
                                    currency_guid=currency_guid,
                                    num=ofxtx.checknum,
                                    post_date=ofxtx.dtposted,
                                    description=ofxtx.name)
            s1 = models.Split(guid=fmt(self._uuidgen()),
                              tx_guid=tx.guid,
                              account_guid=acct.guid,
                              memo=ofxtx.memo,
                              action='',
                              reconcile_state='c',
                              value_num=-ofxtx.trnamt,  # depends on tx type?
                              value_denom=100,
                              quantity_num=-ofxtx.trnamt,  # depends on tx type?
                              quantity_denom=100)

            s2 = models.Split(guid=fmt(self._uuidgen()),
                              tx_guid=tx.guid,
                              account_guid=txfr.guid,
                              memo='',
                              action='',
                              reconcile_state='n',
                              value_num=ofxtx.trnamt,
                              value_denom=100,
                              quantity_num=ofxtx.trnamt,
                              quantity_denom=100)
            online_id = models.TextSlot(obj_guid=s1.guid,
                                        name='online_id',
                                        string_val=ofxtx.fitid)
            session.add(tx)
            session.add(s1)
            session.add(online_id)
            session.add(s2)
        session.flush()
        return novel


class StmtTrn(models.Base, models.ReprMixin):
    '''Temporary table for OFX import.

    .. todo:: detect lost updates by using dtserver or some such.
    '''
    __tablename__ = 'ofx_stmttrn'
    fitid = Column(String(80), primary_key=True)
    checknum = Column(String(80))
    dtposted = Column(DATETIME, nullable=False)
    memo = Column(String(80))
    name = Column(String(80), nullable=False)
    payeeid = Column(String(80))
    trnamt = Column(Integer, nullable=False)  # actual amount * 100
    trntype = Column(String(80))  # todo: enum 'CREDIT', ...
    match_guid = Column(String(32))


class OFXParser(sgmllib.SGMLParser):
    '''Parse OFX into ElementTree structure; extract summary and transactions.

    >>> import pkg_resources
    >>> ofxin = pkg_resources.resource_stream(__name__, 'test/test_ofx.ofx')
    >>> summary, transactions = OFXParser.ofx_data(ofxin)

    >>> import pprint
    >>> pprint.pprint(summary)
    {'acctid': '123456789',
     'balamt': '120.00',
     'bankid': '123456789',
     'curdef': 'USD',
     'dtasof': datetime.datetime(2011, 1, 17, 22, 12, 51),
     'dtserver': datetime.datetime(2011, 1, 17, 22, 12, 51),
     'fid': '5959',
     'org': 'Bank of America'}

    >>> pprint.pprint(list(transactions))
    [{'checknum': '2-6',
      'dtposted': datetime.datetime(2011, 1, 17, 21, 27, 42),
      'fitid': '2-6',
      'memo': '90853',
      'name': 'Jared Fetter',
      'payeeid': '2',
      'trnamt': 6000,
      'trntype': 'CREDIT'},
     {'checknum': '2-9',
      'dtposted': datetime.datetime(2011, 1, 17, 22, 12, 15),
      'fitid': '2-9',
      'memo': '90853',
      'name': 'Jared Fetter',
      'payeeid': '2',
      'trnamt': 6000,
      'trntype': 'CREDIT'}]

    .. todo:: parser to take a list of tags that should be collected,
              with corredponding callbacks. (also: look into monads
              vs callbacks). yield tablename, record

    '''

    @classmethod
    def ofx_data(self, ofxin):
        p = OFXParser()
        p.header(ofxin)  # discard header
        body = ''.join([line for line in ofxin])
        p.feed(body)
        return p.summary(), p.transactions()
        
    @classmethod
    def header(cls, lines):
        for line in lines:
            if not line.strip():
                break
            n, v = line.strip().split(':', 1)
            yield n, v

    @classmethod
    def _whitebox(cls):
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
        '''
        pass

    def __init__(self):
        sgmllib.SGMLParser.__init__(self)
        self._data = []
        self.root = None
        self._ancestors = []

    def unknown_starttag(self, tag, attributes):
        debugstack = [a.tag for a in self._ancestors]
        log.debug('tag: %s in %s', tag, debugstack)

        if self.root is not None:
            if self._poptext():
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
        self._poptext()
        self._ancestors.pop()

    def _poptext(self):
        text = ''.join(self._data).strip()
        if text:
            current = self._ancestors[-1]
            current.text = text
            return True
        return False

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
        ledgerbal = dotelt(self.root.find('.//ledgerbal'))
        _dt = self.parse_date
        return dict(dtserver=_dt(root.find('.//dtserver').text),
                    org=fi.org,
                    fid=fi.fid,
                    curdef=root.find('.//curdef').text,
                    acctid=acct.acctid,
                    bankid=acct.get('bankid'),
                    balamt=ledgerbal.balamt,
                    dtasof=_dt(ledgerbal.dtasof))

    def transactions(self):
        root = self.root
        assert(root is not None)  # ugh... hardly functional
        for e in root.findall('.//stmttrn'):
            tx = dotelt(e)
            yield dict(fitid=tx.fitid,
                       dtposted=self.parse_date(tx.dtposted),
                       checknum=tx.get('checknum'),
                       trntype=tx.trntype,
                       trnamt=int(Decimal(tx.trnamt)*100),
                       name=tx.name,
                       payeeid=tx.get('payeeid'),
                       memo=tx.get('memo'))

    @classmethod
    def parse_date(cls, txt):
        '''
        >>> OFXParser.parse_date('20120423201548.648[-4:EDT]')
        datetime.datetime(2012, 4, 23, 20, 15, 48, 648000, tzinfo=[-4:EDT])

        >>> OFXParser.parse_date('20070315')
        datetime.date(2007, 3, 15)
        '''
        m = re.match(r'(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})'
                     r'(?:(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})'
                     r'(?:\.(?P<frac>\d+))?'
                     r'(?:\[(?P<tzoff>-?\d+):(?P<tzname>\w+)\])?)?',
                     txt)
        if not m:
            raise ValueError(txt)

        if not m.group('hour'):
            year, month, day = [
                int(m.group(part)) for part in
                'year month day'.split()]
            return datetime.date(year, month, day)

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
