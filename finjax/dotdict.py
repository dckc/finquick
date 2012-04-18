class dotdict(dict):
    '''
    ack: Darugar Oct 2008
    http://parand.com/say/index.php/2008/10/24/python-dot-notation-dictionary-access/
    '''
    def __getattr__(self, attr):
        return self.get(attr, None)
    __setattr__= dict.__setitem__
    __delattr__= dict.__delitem__
