from itertools import groupby

from pyramid.response import Response

from sqlalchemy.exc import DBAPIError

from .models import (
    Account, Transaction,
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

        dbq = Transaction.search_query(self._session, q)
        try:
            matches = dbq[:limit]
        except DBAPIError:
            return Response(conn_err_msg,
                            content_type='text/plain', status_int=500)

        def tx_obj(tx_guid, split_details):
            return dict(tx_guid=tx_guid,
                        post_date=split_details[0].post_date.isoformat(),
                        description=split_details[0].description,
                        splits=[
                    dict(split_guid=d.split_guid,
                         account_guid=d.account_guid,
                         memo=d.memo,
                         account_name=d.account_name,
                         account_type=d.account_type,
                         value_num=d.value_num,
                         value_denom=d.value_denom)
                    for d in split_details])

        return [tx_obj(tx_guid, list(split_details))
                for (tx_guid, split_details)
                in groupby(matches, lambda m: m.tx_guid)]


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

