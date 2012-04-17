'''__init__ -- finjax package init: build Pyramid WSGI application

'''


# dependencies from pypi; ../README.rst and ../setup.py
from pyramid.config import Configurator
from sqlalchemy import engine_from_config

from .models import make_session
from .views import AccountsList, TransactionsQuery


def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.

    @see: `paste.app_factory`__
    __ http://pythonpaste.org/deploy/#paste-app-factory

    @param global_config: DEFAULT settings;
                          see file:`development.ini`, `production.ini`
    @param settings: settings for this application
    @return: a WSGI application.
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
