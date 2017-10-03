exports.makePlaidAPI = makePlaidAPI;
function makePlaidAPI() {
    return {
        makeSettings: makeSettings,
        makeClient: makeClient,
    }
}

/*::
// TODO: move to Capper

type Context = {
  make(reviver: string, ...args: Array<any>): Object,
  state: Object
}
 */

function makeSettings(context /*: Context */) {
    return Object.freeze({
        makeClient: (client_id, public_key, secret) =>
            context.make('plaid_api.makeClient', client_id, public_key, secret)
    });
}

function makeClient(context /*: Context */) {
    return Object.freeze({
        init: (client_id, public_key, secret) => {
            console.log('makeClient.init...', client_id);
            const mem = context.state;
            mem.client_id = client_id;
            mem.public_key = public_key;
            mem.secret = secret;
        }
    });
}
