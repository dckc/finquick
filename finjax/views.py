from pyramid.response import Response

from sqlalchemy.exc import DBAPIError

from .models import (
    Accounts,
    )


class JSONView(object):
    def config(self, config, route_name):
        config.add_view(self, route_name=route_name, renderer='json')


class AccountsView(JSONView):
    def __init__(self, session):
        self._session = session

    def __call__(self, request):
        try:
            accounts = self._session.query(Accounts)
        except DBAPIError:
            return Response(conn_err_msg,
                            content_type='text/plain', status_int=500)
        cols = Accounts.__table__.columns
        return [dict([(c.name, getattr(acct, c.name)) for c in cols])
                for acct in accounts]


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

