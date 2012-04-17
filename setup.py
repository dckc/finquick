'''setup -- package dependencies for finjax

per `The Hitchhiker’s Guide to Packaging`__ and PasteDeploy__.

__ http://guide.python-distribute.org/
__ http://pythonpaste.org/deploy/
'''
import os

from setuptools import setup, find_packages

here = os.path.abspath(os.path.dirname(__file__))
README = open(os.path.join(here, 'README.rst')).read()
CHANGES = open(os.path.join(here, 'CHANGES.txt')).read()

requires = [
    'pyramid',
    'SQLAlchemy',
    'transaction',
    'pyramid_tm',
    'zope.sqlalchemy',
    'waitress',
    'MySQL-python'
    ]

setup(name='finjax',
      version='0.1',
      description='finjax',
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
      test_suite='finjax',
      install_requires=requires,
      entry_points="""\
      [paste.app_factory]
      main = finjax:main
      [console_scripts]
      initialize_finjax_db = finjax.scripts.initializedb:main
      """,
      )

