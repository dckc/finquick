/*::
//TODO
type SecretSpace = {
  post(method: string, ...args: Array<any>): Promise<any>
}
type JQuery = {}
 */

import Bacon from 'baconjs';

export function ui(secretSpace /* :SecretSpace */, $ /*: JQuery*/) {
    console.log('@@@building UI...', $);

    $('#items').html('@@@HELLO WORLD.');

    $('#search').asEventStream('click')
        .flatMap(_ => Bacon.fromPromise(secretSpace.post('search')))
        .map(itemsInfo => itemsInfo.map(i => $('<li />', {text: i['Label']})))
        .onValue(itemsElts => {
            $('#items').html(itemsElts)
        });

    function attrs() {
        const attr = $('#attribute').val();
        const val = $('#value').val();
        return {[attr]: val}
    }
    
    $('#subSpace').asEventStream('click')
        .flatMap(_ => Bacon.fromPromise(secretSpace.post('subSpace', attrs())))
        .onValue(subSpace => {
            console.log('@@subSpace:', subSpace);
            $('#subSpaces').append($('<a />', {href: subSpace.webkey, text: '@@TODO'}))
        });
}
