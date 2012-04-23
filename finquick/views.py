'''views -- finquick REST API
'''

from itertools import groupby

from injector import inject
from pyramid.config import Configurator
from pyramid.response import Response
from sqlalchemy.exc import DBAPIError

from dotdict import dotdict
from models import (
    Account, Transaction,
    KSession,
    jrec,
    )


class JSONDBView(object):
    '''View to access DB and render to JSON.
    '''
    @inject(session=KSession)
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

    @classmethod
    def _test_view(cls, **params):
        import models
        from pyramid import testing
        s, _ = models.Mock.make([KSession, None])
        req = testing.DummyRequest(params=params)
        view = cls(s)
        return view(req)


class AccountsList(JSONDBView):
    '''
    Our test data has a ROOT, a BANK, and an EXPENSE:
    >>> obj = AccountsList._test_view()
    >>> [o['account_type'] for o in obj]
    [u'ROOT', u'BANK', u'EXPENSE']
    '''
    def __call__(self, request):
        try:
            accounts = self._session.query(Account)
        except DBAPIError:
            return DBFailHint
        cols = Account.__table__.columns
        # TODO: consider overlap with jrec
        return [dict([(c.name, getattr(acct, c.name)) for c in cols])
                for acct in accounts]


class AccountSummary(JSONDBView):
    '''
    Our test data has a ROOT, a BANK, and an EXPENSE:
    >>> obj = AccountSummary._test_view()
    >>> [(o['account_type'], o['balance']) for o in sorted(obj)]
    [(u'BANK', -250), (u'EXPENSE', 250), (u'ROOT', None)]
    '''
    def __call__(self, request):
        try:
            q = Account.summary(self._session)
        except DBAPIError:
            return DBFailHint
        cols = q.column_descriptions
        return [jrec(acct, cols) for acct in q.all()]


class TransactionsQuery(JSONDBView):
    '''
    .. todo:: query by date, account, amount as well as description/memo

    >>> obj = TransactionsQuery._test_view(q='Electric')
    >>> [tx['description'] for tx in obj]
    [u'Electric company']

    >>> obj = TransactionsQuery._test_view(amount='250')
    >>> [split['value_num'] for tx in obj for split in tx['splits']]
    [-25000, 25000]

    >>> reply = TransactionsQuery._test_view()
    >>> reply.status_int
    400
    '''
    txt_param = 'q'
    account_param = 'account'
    amount_param = 'amount'

    def __call__(self, request, limit=200):
        q, account, amount_ = [
            request.params.get(p, '').strip() or None
            for p in [self.txt_param, self.account_param, self.amount_param]]

        if not (q or account or amount_):
            return Response('no q/account/amount param',
                            content_type='text/plain',
                            status_int = 400)
        try:
            amount = float(amount_) if amount_ else None
        except ValueError:
            return Response('bad amount',
                            content_type='text/plain',
                            status_int = 400)
            
        dbq = Transaction.search_query(self._session,
                                       txt=q, account=account, amount=amount)
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

1.  You may need to run the "initialize_finquick_db" script
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


class FinquickAPI(object):
    '''Finquick REST/JSON API configuration.

    .. todo:: Relax paths. As is, `/account` and `/account/` give 404;
              some text matching {guid} is required, e.g. `/account/-` .
    '''
    account_route = dotdict(name='account', path='/account/{guid}')
    summary_route = dotdict(name='summary', path='/accountSummary')
    transaction_route = dotdict(name='transaction', path='/transaction/{guid}')

    @inject(config=Configurator,
            av=AccountsList,
            sv=AccountSummary,
            tqv=TransactionsQuery)
    def __init__(self, config, av, sv, tqv):
        self._config = config
        self._account_view = av
        self._summary_view = sv
        self._transaction_view = tqv

    def add_rest_api(self):
        for (rt, view) in (
            (self.account_route, self._account_view),
            (self.summary_route, self._summary_view),
            (self.transaction_route, self._transaction_view)):
            self._config.add_route(rt.name, rt.path)
            view.config(self._config, rt.name)
