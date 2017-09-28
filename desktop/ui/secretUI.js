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
    spaceMaker($, attrs => secretSpace.post('subSpace', attrs));
    searchUI($, () => secretSpace.post('search'));
}

function spaceMaker($, subSpace) {
    $('#subSpace').asEventStream('click').log('click')
        .map(_ => ({key: $('#attribute').val(),
                    value: $('#value').val()})).log('input')
        .flatMap(attr => Bacon.fromPromise(subSpace({[attr.key]: attr.value})).log('subSpace')
                 .zip(Bacon.once(attr), (s, a) => [s, a])).log('flatMap / zip')
        .onValue(([subSpace, attr]) => go(subSpace, attr));

    function go(subSpace, attr) {
        $('#child').html(
            $('<iframe />',
              {src: subSpace.webkey,
               class: "embed-responsive-item"}));
        $('#subSpaces').append(
            $('<a />',
              {href: subSpace.webkey,
               text: `${attr.key} = ${attr.value}`})
                .wrap('<li />').parent())
    }
}


function searchUI($, search) {
    $('#search').asEventStream('click')
        .flatMap(_ => Bacon.fromPromise(search()))
        .map(itemsInfo => itemsInfo.map(i => $('<li />', {text: i['Label']})))
        .onValue(itemsElts => {
            $('#items').html(itemsElts)
        });
}
