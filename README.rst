finquick -- web app access to gnucash financial data
====================================================

Support for SQL storage in GnuCash__ 2.4.10 allows reuse of the data
using Web technologies, without extensive study of the GnuCash source
code (which is upwards of 10MB, compressed).

__ http://gnucash.org/

Pyramid__ is "a small, fast, down-to-earth Python web application
development framework." Building a RESTful JSON API to the GnuCash
data is straightforward using SQLAlchemy__ SQL toolkit, which is
conveniently packaged in the `alchemy` scaffold__.

__ http://docs.pylonsproject.org/projects/pyramid/en/1.3-branch/
__ http://docs.sqlalchemy.org/
__ http://docs.pylonsproject.org/projects/pyramid/en/1.3-branch/narr/project.html#scaffolds-included-with-pyramid

Building a browser interface to the JSON data is straightforward
with AngularJS__, a JavaScript framework with two-way databinding,

__ http://docs.angularjs.org/


See `setup.py` for installation and getting started.
