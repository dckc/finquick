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

>>> from xml.etree.ElementTree import tostring
>>> print tostring(p.root)

I see a lot of
VERSION:102

so...

Download OFX Version 1.0.2:

Spec w/ DTD  OFX1.0.2.zip (369K)
http://www.ofx.net/DownloadPage/Downloads.aspx
http://www.ofx.net/DownloadPage/Files/ofx102spec.zip
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

    #empty= ('code', 'severity', 'dtserver', 'language',
    #        'org', 'fid')

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
