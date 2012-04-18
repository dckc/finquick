'''views -- finjax REST API
'''

from itertools import groupby

from injector import inject
from pyramid.config import Configurator
from pyramid.response import Response
from sqlalchemy.exc import DBAPIError

from dotdict import dotdict
from models import (
    Account, Transaction,
    KSessionMaker
    )


class JSONDBView(object):
    '''View to access DB and render to JSON.
    '''
    @inject(session=KSessionMaker)
    def __init__(self, session):
        self._session = session

    def config(self, config, route_name):
        '''Add this view to a Pyramid Configurator.
        '''
        config.add_view(self, route_name=route_name, renderer='json')

    def __call__(self, request):
        '''This class is abstract; subclass must implement __call__.
        '''
        raise NotImplemented


class AccountsList(JSONDBView):
    def __call__(self, request):
        try:
            accounts = self._session.query(Account)
        except DBAPIError:
            return DBFailHint
        cols = Account.__table__.columns
        return [dict([(c.name, getattr(acct, c.name)) for c in cols])
                for acct in accounts]


class TransactionsQuery(JSONDBView):
    '''
    .. todo:: query by date, account, amount as well as description/memo
    '''
    description_memo_query_param = 'q'

    def __call__(self, request, limit=200):
        q = request.params.get(self.description_memo_query_param, None)
        if q is None:
            return Response('missing q param', content_type='text/plain',
                            status_int = 400)

        dbq = Transaction.search_query(self._session, q)
        try:
            matches = dbq[:limit]
        except DBAPIError:
            return DBFailHint

        return [split_denorm(tx_guid, list(split_details))
                for (tx_guid, split_details)
                in groupby(matches, lambda m: m.tx_guid)]


def split_denorm(tx_guid, split_details):
    '''De-normalize transaction split info.

    >>> import datetime, pprint
    >>> when = datetime.datetime(2001, 01, 01, 1, 2, 3)
    >>> o = split_denorm('tx123',
    ...         [dotdict(post_date=when, description='fun fun',
    ...                  split_guid='s456', account_guid='a678',
    ...                  memo='', tx_guid='tx123',
    ...                  account_name='Bank X', account_type='BANK',
    ...                  value_num=-35000, value_denom=100),
    ...          dotdict(post_date=when, description='fun fun',
    ...                  split_guid='s654', account_guid='a876',
    ...                  memo='electric bill', tx_guid='tx123',
    ...                  account_name='Utilities', account_type='EXPENSE',
    ...                  value_num=35000, value_denom=100)])
    >>> pprint.pprint(o)
    {'description': 'fun fun',
     'post_date': '2001-01-01T01:02:03',
     'splits': [{'account_guid': 'a678',
                 'account_name': 'Bank X',
                 'account_type': 'BANK',
                 'memo': '',
                 'split_guid': 's456',
                 'value_denom': 100,
                 'value_num': -35000},
                {'account_guid': 'a876',
                 'account_name': 'Utilities',
                 'account_type': 'EXPENSE',
                 'memo': 'electric bill',
                 'split_guid': 's654',
                 'value_denom': 100,
                 'value_num': 35000}],
     'tx_guid': 'tx123'}
    '''
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

DBFailHint = Response(conn_err_msg,
                      content_type='text/plain', status_int=500)


class FinjaxAPI(object):
    '''Finjax REST/JSON API configuration.

    .. todo:: Relax paths. As is, `/account` and `/account/` give 404;
              some text matching {guid} is required, e.g. `/account/-` .
    '''
    account_route = dotdict(name='account', path='/account/{guid}')
    transaction_route = dotdict(name='transaction', path='/transaction/{guid}')

    @inject(config=Configurator,
            av=AccountsList,
            tqv=TransactionsQuery)
    def __init__(self, config, av, tqv):
        self._config = config
        self._account_view = av
        self._transaction_view = tqv

    def add_rest_api(self):
        for (rt, view) in (
            (self.account_route, self._account_view),
            (self.transaction_route, self._transaction_view)):
            self._config.add_route(rt.name, rt.path)
            view.config(self._config, rt.name)
