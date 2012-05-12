'''
>>> import pkg_resources
>>> ofxin = pkg_resources.resource_stream(__name__, 'test_ofx.ofx')
>>> list(OFXParse.header(ofxin))
... #doctest: +NORMALIZE_WHITESPACE
[('OFXHEADER', '100'), ('DATA', 'OFXSGML'), ('VERSION', '102'),
 ('SECURITY', 'NONE'), ('ENCODING', 'USASCII'),
 ('CHARSET', '1252'), ('COMPRESSION', 'NONE'),
 ('OLDFILEUID', 'NONE'), ('NEWFILEUID', 'NONE')]

'''


class OFXParse(object):
    @classmethod
    def header(self, lines):
        for line in lines:
            if not line.strip():
                break
            n, v = line.strip().split(':', 1)
            yield n, v
