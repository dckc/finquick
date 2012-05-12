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
 'checknum', 'payeeid', 'memo', 'stmttrn', 'ledgerbal']

>>> class dotelt(object):
...     def __init__(self, e):
...         self.e = e
...     def __getattr__(self, n):
...         return self.e.find(n).text
>>> [(t.fitid, t.trnamt, t.dtposted)
...  for t in [dotelt(e) for e in p.root.findall('.//stmttrn')]]
[('2-6', '60.00', '20110117212742'), ('2-9', '60.00', '20110117221215')]

'''

import logging
import sgmllib  # Note: deprecated
from xml.etree.ElementTree import Element

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
        e = self._ancestors.pop()
        e.text = ''.join(self._data).strip()
        self._data = []

    def handle_data(self, data):
        self._data.append(data)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
