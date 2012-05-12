'''
>>> import pkg_resources
>>> ofxin = pkg_resources.resource_stream(__name__, 'test_ofx.ofx')

>>> p = OFXParser()
>>> list(p.header(ofxin))
... #doctest: +NORMALIZE_WHITESPACE
[('OFXHEADER', '100'), ('DATA', 'OFXSGML'), ('VERSION', '102'),
 ('SECURITY', 'NONE'), ('ENCODING', 'USASCII'),
 ('CHARSET', '1252'), ('COMPRESSION', 'NONE'),
 ('OLDFILEUID', 'NONE'), ('NEWFILEUID', 'NONE')]

### logging.basicConfig(level=logging.DEBUG)
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

'''

from xml.etree.ElementTree import Element
import datetime
import logging
import re
import sgmllib  # Note: deprecated

log = logging.getLogger(__name__)


class OFXParser(sgmllib.SGMLParser):

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
                    bankid=acct.get('bankid', None))

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
        return self.e.find(n).text

    def get(self, n, default):
        ch = self.e.find(n)
        return ch.text if ch is not None else default


if __name__ == '__main__':
    import doctest
    doctest.testmod()
