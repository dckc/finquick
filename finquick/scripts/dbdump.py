'''dbdump -- dump sqlalchemy DB to TSV format files in a directory

Usage:
  python dbdump.py ''engine_url'' ''directory_name''

e.g.:
  python dbdump.py sqlite:///gc-checking.gnucash gc-tsv
'''

import logging
import os
import csv

import sqlalchemy

log = logging.getLogger(__name__)


def main(argv):
    engine_url, dest_dir = argv[1:3]
    engine = sqlalchemy.create_engine(engine_url)
    meta = sqlalchemy.MetaData()
    meta.reflect(bind=engine)
    log.debug("tables in %s: %s", engine_url, meta.tables.keys())

    for name, tbl in meta.tables.items():
        fn = os.path.join(dest_dir, name) + '.txt'
        log.info('dumping %s to %s', name, fn)
        table_dump(open(fn, 'w'), engine, tbl)


def table_dump(fp, engine, tbl):
    colnames = [c.name for c in tbl.columns]
    o = csv.DictWriter(fp, colnames,
                       # actually, mysql-tab; hmm...
                       dialect='excel-tab')

    # chunking for really large tables?
    o.writerows([
        dict([(k, str(v)) for k, v in row.items()])
        for row in engine.execute(tbl.select())])


if __name__ == '__main__':
    import sys
    logging.basicConfig(level=logging.DEBUG)
    main(sys.argv)
