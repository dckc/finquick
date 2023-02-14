import Bacon from 'baconjs';

/*::
// TODO: JS proxy for remote? Q connection idiom?
type Remote = {
  post(method: string, ...args: Array<any>): Promise<any>
}
type JQuery = {} // TODO
 */

export function settingsUI(settings /*: Remote */, $ /*: JQuery*/) {
    console.log('@@@building UI...', $);

    $('#create').asEventStream('click')
        .log('click@@')
        .map(_ => ({
            client_id: $('#client-id').val(),
            public_key: $('#public-key').val(),
            secret: $('#secret').val()
        }))
        .log('fields@@')
        .flatMap(fields => Bacon.fromPromise(
            settings.post('makeClient', fields.client_id, fields.public_key, fields.secret)))
        .log('client@@')
        .onValue(show);

    function show(client) {
        $('#newClient').html($('<a />', {
            href: client.webkey,
            text: "Plaid API Client"
        }));
    }
}


export function linkUI(client /*: Remote */, $ /*: JQuery*/, Plaid /*: any*/, Q /*: any*/) {
    const clientName = 'fincap@@';
    const environment = 'development'; // TODO: parameterize?

    const tokenP = Q.defer();
    client.post('getPublicKey')
        .then(key => Plaid.create({
            apiVersion: 'v2',
            clientName: clientName,
            env: environment,
            product: ['transactions'],
            key: key,
            onSuccess: t => tokenP.resolve(t)
        }))
        .then(handler => {
            $('#link-btn').asEventStream('click')
                .log('link-btn@@')
                .onValue(_e => handler.open());
        });

    Bacon.fromPromise(tokenP.promise)
        .log('public token')
        .flatMap(public_token => client.post('getAccessToken', {public_token: public_token}))
        .log('access token@@')
        .onValue(_tok => {
            $('#container').fadeOut('fast', () => {
                $('#intro').hide();
                $('#app, #steps').fadeIn('slow');
            });
        });
}
