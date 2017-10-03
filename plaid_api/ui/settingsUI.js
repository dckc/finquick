import Bacon from 'baconjs';

/*::
// TODO: JS proxy for remote? Q connection idiom?
type Remote = {
  post(method: string, ...args: Array<any>): Promise<any>
}
type JQuery = {} // TODO
 */

export function ui(settings /*: Remote */, $ /*: JQuery*/) {
    console.log('@@@building UI...', $);
    clientMaker($, settings);
}

function clientMaker($, settings) {
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
