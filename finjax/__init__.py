from pyramid.config import Configurator
from sqlalchemy import engine_from_config

from .models import make_session
from .views import AccountsView

def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    engine = engine_from_config(settings, 'sqlalchemy.')
    session = make_session()
    session.configure(bind=engine)

    config = Configurator(settings=settings)
    config.add_static_view('static', 'static', cache_max_age=3600)

    config.add_route('accounts', '/accounts')
    av = AccountsView(session)
    av.config(config, 'accounts')

    return config.make_wsgi_app()

