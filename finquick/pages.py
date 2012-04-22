# cribbed from http://docs.pylonsproject.org/projects/pyramid/en/1.3-branch/narr/assets.html#static-assets-section

import os
from pyramid.response import FileResponse


def accounts(request):
    here = os.path.dirname(__file__)
    doc = os.path.join(here, 'static', 'accounts.html')
    return FileResponse(doc, request=request)


def transactions(request):
    here = os.path.dirname(__file__)
    doc = os.path.join(here, 'static', 'transactions.html')
    return FileResponse(doc, request=request)


def favicon(request):
    here = os.path.dirname(__file__)
    icon = os.path.join(here, 'static', 'favicon.ico')
    return FileResponse(icon, request=request)

