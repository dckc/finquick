'''__init__ -- finquick package init: build Pyramid WSGI application

'''

# dependencies from pypi; ../README.rst and ../setup.py
import injector
from injector import provides, singleton
from pyramid.config import Configurator
import sqlalchemy

import models
import views
import pages


def main(global_config, **settings):
    """Build finquick Pyramid WSGI application.

    @see: `paste.app_factory`__
    __ http://pythonpaste.org/deploy/#paste-app-factory

    @param global_config: DEFAULT settings;
                          see file:`development.ini`, `production.ini`
    @param settings: settings for this application
    @return: a WSGI application, i.e. a (env, start_response) callable.

    >>> app = main({}, **dict({RunTime.db_section + 'url': 'sqlite:///',
    ...                        RunTime.db_bootstrap_flag: 'true'}))

    Calling with too few args gives a TypeError:
    >>> app()
    Traceback (most recent call last):
      ...
    TypeError: __call__() takes exactly 3 arguments (1 given)
    """
    finquick, config = RunTime.make(settings, [views.FinquickAPI, Configurator])
    finquick.add_rest_api()
    return config.make_wsgi_app()


class RunTime(injector.Module):
    '''Use runtime config settings to bootstrap dependency injection.
    '''

    db_section = 'sqlalchemy.'
    db_bootstrap_flag = 'bootstrap_db'
    def __init__(self, settings):
        '''
        @param settings: as per `paste.app_factory`
        '''
        self._settings = settings

    @singleton
    @provides(Configurator)
    def app_settings(self):
        config = Configurator(settings=self._settings)

        config.add_route('accounts', '')
        config.add_view(pages.accounts, route_name='accounts')

        config.add_route('transactions', 'transactions')
        config.add_view(pages.transactions, route_name='transactions')

        config.add_route('favicon', 'favicon.ico')
        config.add_view(pages.favicon, route_name='favicon')

        config.add_static_view('static', 'static', cache_max_age=3600)

        return config

    @singleton
    @provides(sqlalchemy.engine.Engine)
    def db(self):
        e = sqlalchemy.engine_from_config(self._settings, self.db_section)
        if self.db_bootstrap_flag in self._settings:
            models.Mock().bootstrap(e)
        return e

    @classmethod
    def make(cls, settings, what):
        '''Given app settings, instantiate classes with dependency injection.

        @param settings: as per `paste.app_factory`
        @param what: list of classes to instantiate;
                     use None as list item to get the whole Injector depgraph.
        '''
        mods = [cls(settings), models.DBConfig()]
        depgraph = injector.Injector(mods)
        return [depgraph.get(it) if it else depgraph
                for it in what]
