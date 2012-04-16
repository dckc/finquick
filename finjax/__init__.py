from pyramid.config import Configurator
from sqlalchemy import engine_from_config

from .models import make_session
from .views import AccountsList, TransactionsQuery


def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    engine = engine_from_config(settings, 'sqlalchemy.')
    session = make_session()
    session.configure(bind=engine)

    config = Configurator(settings=settings)
    config.add_static_view('static', 'static', cache_max_age=3600)

    config.add_route('account', '/account/{guid}')
    av = AccountsList(session)
    av.config(config, 'account')

    config.add_route('transaction', '/transaction/{guid}')
    tv = TransactionsQuery(session)
    tv.config(config, 'transaction')

    return config.make_wsgi_app()

