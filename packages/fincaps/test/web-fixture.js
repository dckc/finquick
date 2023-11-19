// @ts-check
const { stringify: jq } = JSON;

/**
 * @file to regenerate
 *   1. set RECORDING=true in test-interpose-net-access.js
 *   2. run: yarn test test/test-test-interpose-net-access.js --update-snapshots
 *   3. for each map in XXX.js.md, copy it and
 *   4. replace all occurences of => with , and paste as args to Object.fromEntries()
 *   5. change RECORDING back to false
 */
export const web1 = new Map([
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1674202955,\\"method\\":\\"abci_query\\",\\"params\\":{\\"path\\":\\"/cosmos.auth.v1beta1.Query/Account\\",\\"data\\":\\"0a2d61676f7269633134706672786736336a6e3668613063703677786b6d346e6c76737774736372683270796d776d\\",\\"prove\\":false}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 958169458544,
      jsonrpc: '2.0',
      result: {
        response: {
          code: 0,
          codespace: '',
          height: '231904',
          index: '0',
          info: '',
          key: null,
          log: '',
          proofOps: null,
          value:
            'Cp8BCiAvY29zbW9zLmF1dGgudjFiZXRhMS5CYXNlQWNjb3VudBJ7Ci1hZ29yaWMxNHBmcnhnNjNqbjZoYTBjcDZ3eGttNG5sdnN3dHNjcmgycHltd20SRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDqQIsF8FXDVUfIinEmeWL6TgbatIB2jJt9fMaWJSgBmIYBiAr',
        },
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":722766156,\\"method\\":\\"status\\",\\"params\\":{}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 663844313452,
      jsonrpc: '2.0',
      result: {
        node_info: {
          channels: '40202122233038606100',
          id: '673658b0422eda25157b4a692ec5893c9358e777',
          listen_addr: 'tcp://0.0.0.0:26656',
          moniker: 'localnet',
          network: 'agoriclocal',
          other: {
            rpc_address: 'tcp://0.0.0.0:26657',
            tx_index: 'on',
          },
          protocol_version: {
            app: '0',
            block: '11',
            p2p: '8',
          },
          version: '0.34.23',
        },
        sync_info: {
          catching_up: false,
          earliest_app_hash:
            'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
          earliest_block_hash:
            '12A2B11692077E79D4894D785D1076A46113D081EAF41857A040CE856ADC4FD6',
          earliest_block_height: '682',
          earliest_block_time: '2023-11-14T17:31:55.266916047Z',
          latest_app_hash:
            '4BE5B8588212FA559781DCA1B072606080CC79273BC8379085E4E6727AB69FA9',
          latest_block_hash:
            '18F99510DBA1B66B76134046A07412B36E39CD239F010DAE37B895F48F332413',
          latest_block_height: '231904',
          latest_block_time: '2023-11-19T20:09:35.854091721Z',
        },
        validator_info: {
          address: '2194775939FF925292A47E63B936053EF1A395B9',
          pub_key: {
            type: 'tendermint/PubKeyEd25519',
            value: 'WNj5xonr8IoNORSCpui/4F9WI7GhNVKUC07qnQjToaU=',
          },
          voting_power: '5000',
        },
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1716998887,\\"method\\":\\"broadcast_tx_sync\\",\\"params\\":{\\"tx\\":\\"CowBCokBChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEmkKLWFnb3JpYzE0cGZyeGc2M2puNmhhMGNwNnd4a200bmx2c3d0c2NyaDJweW13bRItYWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdxGgkKBHVibGQSATESYwpQCkYKHy9jb3Ntb3MuY3J5cHRvLnNlY3AyNTZrMS5QdWJLZXkSIwohA6kCLBfBVw1VHyIpxJnli+k4G2rSAdoybfXzGliUoAZiEgQKAggBGCsSDwoJCgR1aXN0EgEwEOCnEhpA9RWhA89uKrMq14QIZhZv+FcrvsxV9N7Hu4Su7Bodl3Vj7hH0v6vrrc+nG2/9JzukJtFqRUrKmWnOwIajrSlMGQ==\\"}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 797666298518,
      jsonrpc: '2.0',
      result: {
        code: 0,
        codespace: '',
        data: '',
        hash: '4E3CC7E178696FC1013DA53E714DBD2C983D60AB9B937E8ADC1A93870E926A83',
        log: '[]',
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1235013653,\\"method\\":\\"tx_search\\",\\"params\\":{\\"query\\":\\"tx.hash=\'4E3CC7E178696FC1013DA53E714DBD2C983D60AB9B937E8ADC1A93870E926A83\'\\",\\"page\\":\\"1\\"}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 781573352955,
      jsonrpc: '2.0',
      result: {
        total_count: '1',
        txs: [
          {
            hash: '4E3CC7E178696FC1013DA53E714DBD2C983D60AB9B937E8ADC1A93870E926A83',
            height: '231905',
            index: 0,
            tx: 'CowBCokBChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEmkKLWFnb3JpYzE0cGZyeGc2M2puNmhhMGNwNnd4a200bmx2c3d0c2NyaDJweW13bRItYWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdxGgkKBHVibGQSATESYwpQCkYKHy9jb3Ntb3MuY3J5cHRvLnNlY3AyNTZrMS5QdWJLZXkSIwohA6kCLBfBVw1VHyIpxJnli+k4G2rSAdoybfXzGliUoAZiEgQKAggBGCsSDwoJCgR1aXN0EgEwEOCnEhpA9RWhA89uKrMq14QIZhZv+FcrvsxV9N7Hu4Su7Bodl3Vj7hH0v6vrrc+nG2/9JzukJtFqRUrKmWnOwIajrSlMGQ==',
            tx_result: {
              code: 0,
              codespace: '',
              data: 'Ch4KHC9jb3Ntb3MuYmFuay52MWJldGExLk1zZ1NlbmQ=',
              events: [
                {
                  attributes: [
                    {
                      index: true,
                      key: 'ZmVl',
                      value: 'MHVpc3Q=',
                    },
                  ],
                  type: 'tx',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'YWNjX3NlcQ==',
                      value:
                        'YWdvcmljMTRwZnJ4ZzYzam42aGEwY3A2d3hrbTRubHZzd3RzY3JoMnB5bXdtLzQz',
                    },
                  ],
                  type: 'tx',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'c2lnbmF0dXJl',
                      value:
                        'OVJXaEE4OXVLck1xMTRRSVpoWnYrRmNydnN4VjlON0h1NFN1N0JvZGwzVmo3aEgwdjZ2cnJjK25HMi85Snp1a0p0RnFSVXJLbVduT3dJYWpyU2xNR1E9PQ==',
                    },
                  ],
                  type: 'tx',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'YWN0aW9u',
                      value: 'L2Nvc21vcy5iYW5rLnYxYmV0YTEuTXNnU2VuZA==',
                    },
                  ],
                  type: 'message',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'c3BlbmRlcg==',
                      value:
                        'YWdvcmljMTRwZnJ4ZzYzam42aGEwY3A2d3hrbTRubHZzd3RzY3JoMnB5bXdt',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MXVibGQ=',
                    },
                  ],
                  type: 'coin_spent',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'cmVjZWl2ZXI=',
                      value:
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdx',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MXVibGQ=',
                    },
                  ],
                  type: 'coin_received',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'cmVjaXBpZW50',
                      value:
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdx',
                    },
                    {
                      index: true,
                      key: 'c2VuZGVy',
                      value:
                        'YWdvcmljMTRwZnJ4ZzYzam42aGEwY3A2d3hrbTRubHZzd3RzY3JoMnB5bXdt',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MXVibGQ=',
                    },
                  ],
                  type: 'transfer',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'c2VuZGVy',
                      value:
                        'YWdvcmljMTRwZnJ4ZzYzam42aGEwY3A2d3hrbTRubHZzd3RzY3JoMnB5bXdt',
                    },
                  ],
                  type: 'message',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'bW9kdWxl',
                      value: 'YmFuaw==',
                    },
                  ],
                  type: 'message',
                },
              ],
              gas_used: '60978',
              gas_wanted: '300000',
              info: '',
              log: '[{"events":[{"type":"coin_received","attributes":[{"key":"receiver","value":"agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq"},{"key":"amount","value":"1ubld"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"agoric14pfrxg63jn6ha0cp6wxkm4nlvswtscrh2pymwm"},{"key":"amount","value":"1ubld"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmos.bank.v1beta1.MsgSend"},{"key":"sender","value":"agoric14pfrxg63jn6ha0cp6wxkm4nlvswtscrh2pymwm"},{"key":"module","value":"bank"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq"},{"key":"sender","value":"agoric14pfrxg63jn6ha0cp6wxkm4nlvswtscrh2pymwm"},{"key":"amount","value":"1ubld"}]}]}]',
            },
          },
        ],
      },
    },
  ],
]);
