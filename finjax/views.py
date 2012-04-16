from pyramid.response import Response

from sqlalchemy import or_
from sqlalchemy.exc import DBAPIError

from .models import (
    Account, Transaction, Split,
    jrec
    )


class JSONDBView(object):
    def __init__(self, session):
        self._session = session

    def config(self, config, route_name):
        config.add_view(self, route_name=route_name, renderer='json')


class AccountsList(JSONDBView):
    def __call__(self, request):
        try:
            accounts = self._session.query(Account)
        except DBAPIError:
            return Response(conn_err_msg,
                            content_type='text/plain', status_int=500)
        cols = Account.__table__.columns
        return [dict([(c.name, getattr(acct, c.name)) for c in cols])
                for acct in accounts]


class TransactionsQuery(JSONDBView):
    def __call__(self, request, limit=200):
        q = request.params.get('q', None)
        if q is None:
            return Response('missing q param', content_type='text/plain',
                            status_int = 400)

        try:
            qpattern = '%' + q + '%'
            matches = self._session.query(Split).join(Transaction).filter(
                or_(Split.memo.like(qpattern),
                    Transaction.description.like(qpattern)))[:limit]
        except DBAPIError:
            return Response(conn_err_msg,
                            content_type='text/plain', status_int=500)
        scols = Split.__table__.columns
        tcols = Transaction.__table__.columns

        # todo: return all the splits of the relevant transactions
        return [{'tx': jrec(split.transaction, tcols),
                 'split': jrec(split, scols)}
                  for split in matches]


conn_err_msg = """\
Pyramid is having a problem using your SQL database.  The problem
might be caused by one of the following things:

1.  You may need to run the "initialize_finjax_db" script
    to initialize your database tables.  Check your virtual 
    environment's "bin" directory for this script and try to run it.

2.  Your database server may not be running.  Check that the
    database server referred to by the "sqlalchemy.url" setting in
    your "development.ini" file is running.

After you fix the problem, please restart the Pyramid application to
try it again.
"""

