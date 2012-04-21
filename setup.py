'''setup -- installation and getting started with finquick

For now, we assume some familiarity with virtualenv,
`The Hitchhiker's Guide to Packaging`__, and PasteDeploy__.

__ http://guide.python-distribute.org/
__ http://pythonpaste.org/deploy/

**Note Well** I recommend using `--no-site-packages` when you
set up a virual environment for finquick development, because
zope.sqlalchemy seems to interact poorly with something otherwise,
leading to the dreaded `ImportError: No module named sqlalchemy`.


Getting Started
---------------

- cd <directory containing this file>

- `$venv/bin/python setup.py develop` to install dependencies
  in your development environment.

- `$venv/bin/pserve development.ini` to start the server;
  it prints a web address at start-up; point your browser there.


Testing
-------

The pyramid `alchemy` scaffold came with unit testing infrastructure,
but I much prefer doctests right with the code.

I haven't mastered the `test_requires` packaging stuff, so just do:

  $ pip install nose
  $ pip install cover

Then you can run the tests with the `nose doctest plugin`__:

  $ nosetests --with-doctest

__ http://readthedocs.org/docs/nose/en/latest/plugins/doctests.html

For a nice HTML report:

  $ nosetests --with-doctest --cover-html

'''
import os

from setuptools import setup, find_packages

here = os.path.abspath(os.path.dirname(__file__))
README = open(os.path.join(here, 'README.rst')).read()
CHANGES = open(os.path.join(here, 'CHANGES.txt')).read()

requires = [
    'injector',
    'pyramid',
    'SQLAlchemy',
    'transaction',
    'pyramid_tm',
    'zope.sqlalchemy',
    'waitress',
    'MySQL-python'
    ]

setup(name='finquick',
      version='0.1',
      description='finquick',
      long_description=README + '\n\n' +  CHANGES,
      classifiers=[
        "Programming Language :: Python",
        "Programming Language :: JavaScript",
        "Framework :: Pylons",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Internet :: WWW/HTTP :: WSGI :: Application",
        "Topic :: Office/Business :: Financial :: Accounting",
        "Environment :: Web Environment",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved",
        "License :: OSI Approved :: Apache Software License",
        ],
      author='Dan Connolly',
      author_email='dckc@madmode.com',
      url='http://www.madmode.com/',
      keywords='web wsgi bfg pylons pyramid gnucash',
      packages=find_packages(),
      include_package_data=True,
      zip_safe=False,
      test_suite='finquick',
      install_requires=requires,
      entry_points="""\
      [paste.app_factory]
      main = finquick:main
      [console_scripts]
      initialize_finquick_db = finquick.scripts.initializedb:main
      """,
      )

