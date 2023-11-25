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
    '["http://localhost:1317/agoric/vstorage/data/published.agoricNames.brand",{"keepalive":true,"headers":{"Content-Type":"application/json"}}]',
    {
      value:
        '{"blockHeight":"932","values":["{\\"body\\":\\"#[[\\\\\\"ATOM\\\\\\",\\\\\\"$0.Alleged: ATOM brand\\\\\\"],[\\\\\\"BLD\\\\\\",\\\\\\"$1.Alleged: BLD brand\\\\\\"],[\\\\\\"DAI_axl\\\\\\",\\\\\\"$2.Alleged: DAI_axl brand\\\\\\"],[\\\\\\"DAI_grv\\\\\\",\\\\\\"$3.Alleged: DAI_grv brand\\\\\\"],[\\\\\\"IST\\\\\\",\\\\\\"$4.Alleged: IST brand\\\\\\"],[\\\\\\"Invitation\\\\\\",\\\\\\"$5.Alleged: Zoe Invitation brand\\\\\\"],[\\\\\\"KREAdCHARACTER\\\\\\",\\\\\\"$6.Alleged: KREAdCHARACTER brand\\\\\\"],[\\\\\\"KREAdITEM\\\\\\",\\\\\\"$7.Alleged: KREAdITEM brand\\\\\\"],[\\\\\\"USDC_axl\\\\\\",\\\\\\"$8.Alleged: USDC_axl brand\\\\\\"],[\\\\\\"USDC_grv\\\\\\",\\\\\\"$9.Alleged: USDC_grv brand\\\\\\"],[\\\\\\"USDT_axl\\\\\\",\\\\\\"$10.Alleged: USDT_axl brand\\\\\\"],[\\\\\\"USDT_grv\\\\\\",\\\\\\"$11.Alleged: USDT_grv brand\\\\\\"],[\\\\\\"timer\\\\\\",\\\\\\"$12.Alleged: timerBrand\\\\\\"],[\\\\\\"stATOM\\\\\\",\\\\\\"$13.Alleged: stATOM brand\\\\\\"]]\\",\\"slots\\":[\\"board05557\\",\\"board0566\\",\\"board05736\\",\\"board03138\\",\\"board0257\\",\\"board0074\\",\\"board03281\\",\\"board00282\\",\\"board03040\\",\\"board04542\\",\\"board01744\\",\\"board03446\\",\\"board0425\\",\\"board00990\\"]}"]}',
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":244401194,\\"method\\":\\"abci_query\\",\\"params\\":{\\"path\\":\\"/cosmos.auth.v1beta1.Query/Account\\",\\"data\\":\\"0a2d61676f7269633161337a753561717732353571307475787a793961667476676865656b77327765647a33787771\\",\\"prove\\":false}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 764416433138,
      jsonrpc: '2.0',
      result: {
        response: {
          code: 0,
          codespace: '',
          height: '2740',
          index: '0',
          info: '',
          key: null,
          log: '',
          proofOps: null,
          value:
            'Cp8BCiAvY29zbW9zLmF1dGgudjFiZXRhMS5CYXNlQWNjb3VudBJ7Ci1hZ29yaWMxYTN6dTVhcXcyNTVxMHR1eHp5OWFmdHZnaGVla3cyd2VkejN4d3ESRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEC4YomNap2bl1JGl4oNR1DEa+fVBiEPQlECpIVLhAS6AkYDyAK',
        },
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":219214959,\\"method\\":\\"abci_query\\",\\"params\\":{\\"path\\":\\"/cosmos.tx.v1beta1.Service/Simulate\\",\\"data\\":\\"12e8030a8f030a8c030a252f61676f7269632e7377696e677365742e4d736757616c6c65745370656e64416374696f6e12e2020a14ec45ca740e552807af86110bd4ad88be736729d912c9027b22626f6479223a22237b5c226d6574686f645c223a5c22657865637574654f666665725c222c5c226f666665725c223a7b5c2269645c223a5c2272657365727665416464315c222c5c22696e7669746174696f6e537065635c223a7b5c2263616c6c506970655c223a5b5b5c226d616b65416464436f6c6c61746572616c496e7669746174696f6e5c222c5b5d5d5d2c5c22696e7374616e6365506174685c223a5b5c22726573657276655c225d2c5c22736f757263655c223a5c2261676f726963436f6e74726163745c227d2c5c2270726f706f73616c5c223a7b5c22676976655c223a7b5c22436f6c6c61746572616c5c223a7b5c226272616e645c223a5c2224302e416c6c656765643a20495354206272616e645c222c5c2276616c75655c223a5c222b31305c227d7d7d7d7d222c22736c6f7473223a5b22626f61726430323537225d7d12520a4e0a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a2102e18a2635aa766e5d491a5e28351d4311af9f5418843d09440a92152e1012e80912020a00180a12001a00\\",\\"prove\\":false}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 316175377566,
      jsonrpc: '2.0',
      result: {
        response: {
          code: 0,
          codespace: '',
          height: '2740',
          index: '0',
          info: '',
          key: null,
          log: '',
          proofOps: null,
          value:
            'CgQQwZ8HEtoBCikKJwolL2Fnb3JpYy5zd2luZ3NldC5Nc2dXYWxsZXRTcGVuZEFjdGlvbhJxW3siZXZlbnRzIjpbeyJ0eXBlIjoibWVzc2FnZSIsImF0dHJpYnV0ZXMiOlt7ImtleSI6ImFjdGlvbiIsInZhbHVlIjoiL2Fnb3JpYy5zd2luZ3NldC5Nc2dXYWxsZXRTcGVuZEFjdGlvbiJ9XX1dfV0aOgoHbWVzc2FnZRIvCgZhY3Rpb24SJS9hZ29yaWMuc3dpbmdzZXQuTXNnV2FsbGV0U3BlbmRBY3Rpb24=',
        },
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":722766156,\\"method\\":\\"status\\",\\"params\\":{}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 167287613223,
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
            'C2949709272A56F53B32C79D41C29724BBABE0D875E22147145670B17603997C',
          latest_block_hash:
            'F012B1315F134C3BD45044B10BD4AF363A67040679CE2AD2D3049CA9F439432F',
          latest_block_height: '2740',
          latest_block_time: '2023-11-25T17:51:33.127154506Z',
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
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":744256138,\\"method\\":\\"broadcast_tx_sync\\",\\"params\\":{\\"tx\\":\\"Co8DCowDCiUvYWdvcmljLnN3aW5nc2V0Lk1zZ1dhbGxldFNwZW5kQWN0aW9uEuICChTsRcp0DlUoB6+GEQvUrYi+c2cp2RLJAnsiYm9keSI6IiN7XCJtZXRob2RcIjpcImV4ZWN1dGVPZmZlclwiLFwib2ZmZXJcIjp7XCJpZFwiOlwicmVzZXJ2ZUFkZDFcIixcImludml0YXRpb25TcGVjXCI6e1wiY2FsbFBpcGVcIjpbW1wibWFrZUFkZENvbGxhdGVyYWxJbnZpdGF0aW9uXCIsW11dXSxcImluc3RhbmNlUGF0aFwiOltcInJlc2VydmVcIl0sXCJzb3VyY2VcIjpcImFnb3JpY0NvbnRyYWN0XCJ9LFwicHJvcG9zYWxcIjp7XCJnaXZlXCI6e1wiQ29sbGF0ZXJhbFwiOntcImJyYW5kXCI6XCIkMC5BbGxlZ2VkOiBJU1QgYnJhbmRcIixcInZhbHVlXCI6XCIrMTBcIn19fX19Iiwic2xvdHMiOlsiYm9hcmQwMjU3Il19EmYKUApGCh8vY29zbW9zLmNyeXB0by5zZWNwMjU2azEuUHViS2V5EiMKIQLhiiY1qnZuXUkaXig1HUMRr59UGIQ9CUQKkhUuEBLoCRIECgIIARgKEhIKDAoEdWJsZBIEMTY2MxDBkgoaQF/uWl1Ks3yvyaREDZ3264YR2/bPHfvebG1UJCHVObZmM17qcDPiUIX+QU5JUfGtHhsZlIbP+IN16mpvTeP0Y5M=\\"}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 294298561798,
      jsonrpc: '2.0',
      result: {
        code: 0,
        codespace: '',
        data: '',
        hash: '7AEE11A38DD94F66F73237CFE30D3987166C2CE2CA221A3FBD824571238AF214',
        log: '[]',
      },
    },
  ],
  [
    '["http://localhost:26657",{"method":"POST","body":"{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1232884544,\\"method\\":\\"tx_search\\",\\"params\\":{\\"query\\":\\"tx.hash=\'7AEE11A38DD94F66F73237CFE30D3987166C2CE2CA221A3FBD824571238AF214\'\\",\\"page\\":\\"1\\"}}","headers":{"Content-Type":"application/json"}}]',
    {
      id: 764317591665,
      jsonrpc: '2.0',
      result: {
        total_count: '1',
        txs: [
          {
            hash: '7AEE11A38DD94F66F73237CFE30D3987166C2CE2CA221A3FBD824571238AF214',
            height: '2741',
            index: 0,
            tx: 'Co8DCowDCiUvYWdvcmljLnN3aW5nc2V0Lk1zZ1dhbGxldFNwZW5kQWN0aW9uEuICChTsRcp0DlUoB6+GEQvUrYi+c2cp2RLJAnsiYm9keSI6IiN7XCJtZXRob2RcIjpcImV4ZWN1dGVPZmZlclwiLFwib2ZmZXJcIjp7XCJpZFwiOlwicmVzZXJ2ZUFkZDFcIixcImludml0YXRpb25TcGVjXCI6e1wiY2FsbFBpcGVcIjpbW1wibWFrZUFkZENvbGxhdGVyYWxJbnZpdGF0aW9uXCIsW11dXSxcImluc3RhbmNlUGF0aFwiOltcInJlc2VydmVcIl0sXCJzb3VyY2VcIjpcImFnb3JpY0NvbnRyYWN0XCJ9LFwicHJvcG9zYWxcIjp7XCJnaXZlXCI6e1wiQ29sbGF0ZXJhbFwiOntcImJyYW5kXCI6XCIkMC5BbGxlZ2VkOiBJU1QgYnJhbmRcIixcInZhbHVlXCI6XCIrMTBcIn19fX19Iiwic2xvdHMiOlsiYm9hcmQwMjU3Il19EmYKUApGCh8vY29zbW9zLmNyeXB0by5zZWNwMjU2azEuUHViS2V5EiMKIQLhiiY1qnZuXUkaXig1HUMRr59UGIQ9CUQKkhUuEBLoCRIECgIIARgKEhIKDAoEdWJsZBIEMTY2MxDBkgoaQF/uWl1Ks3yvyaREDZ3264YR2/bPHfvebG1UJCHVObZmM17qcDPiUIX+QU5JUfGtHhsZlIbP+IN16mpvTeP0Y5M=',
            tx_result: {
              code: 0,
              codespace: '',
              data: 'CicKJS9hZ29yaWMuc3dpbmdzZXQuTXNnV2FsbGV0U3BlbmRBY3Rpb24=',
              events: [
                {
                  attributes: [
                    {
                      index: true,
                      key: 'c3BlbmRlcg==',
                      value:
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdx',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MTY2M3VibGQ=',
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
                        'YWdvcmljMWFlMGxtdHpsZ3JjbmxhOXhqa3BhYXJxNWQ1ZGZlejYzaDNudWNs',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MTY2M3VibGQ=',
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
                        'YWdvcmljMWFlMGxtdHpsZ3JjbmxhOXhqa3BhYXJxNWQ1ZGZlejYzaDNudWNs',
                    },
                    {
                      index: true,
                      key: 'c2VuZGVy',
                      value:
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdx',
                    },
                    {
                      index: true,
                      key: 'YW1vdW50',
                      value: 'MTY2M3VibGQ=',
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
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdx',
                    },
                  ],
                  type: 'message',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'ZmVl',
                      value: 'MTY2M3VibGQ=',
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
                        'YWdvcmljMWEzenU1YXF3MjU1cTB0dXh6eTlhZnR2Z2hlZWt3MndlZHozeHdxLzEw',
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
                        'WCs1YVhVcXpmSy9KcEVRTm5mYnJoaEhiOXM4ZCs5NXNiVlFrSWRVNXRtWXpYdXB3TStKUWhmNUJUa2xSOGEwZUd4bVVocy80ZzNYcWFtOU40L1Jqa3c9PQ==',
                    },
                  ],
                  type: 'tx',
                },
                {
                  attributes: [
                    {
                      index: true,
                      key: 'YWN0aW9u',
                      value:
                        'L2Fnb3JpYy5zd2luZ3NldC5Nc2dXYWxsZXRTcGVuZEFjdGlvbg==',
                    },
                  ],
                  type: 'message',
                },
              ],
              gas_used: '129558',
              gas_wanted: '166209',
              info: '',
              log: '[{"events":[{"type":"message","attributes":[{"key":"action","value":"/agoric.swingset.MsgWalletSpendAction"}]}]}]',
            },
          },
        ],
      },
    },
  ],
  [
    '["http://localhost:1317/cosmos/base/tendermint/v1beta1/blocks/latest",{"keepalive":true,"headers":{"Content-Type":"application/json"}}]',
    {
      block: {
        data: {
          txs: [],
        },
        evidence: {
          evidence: [],
        },
        header: {
          app_hash: 'ODaYlSNPWvtWZpimCQM/zW1StqEsfQ7FSzJ/Oekl/BU=',
          chain_id: 'agoriclocal',
          consensus_hash: 'BICRvH3cKD93v7+R1zxE2ljD34qcvIZ0Bdi389qtoi8=',
          data_hash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
          evidence_hash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
          height: '2743',
          last_block_id: {
            hash: 'Dhj1YWZKyIC8PHMX6tCQ6zLQB3MYsE5zFadiKKife/U=',
            part_set_header: {
              hash: 'K1cBu6KkD0HG9kNcYZGLMbyKr6uDheaCYRoxZVMo1RE=',
              total: 1,
            },
          },
          last_commit_hash: 'chb/5kzP0L3c+wCNMZeiep9GsMH/KKnEmj+YuLJ+mF4=',
          last_results_hash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
          next_validators_hash: 'HkUtdy6sZwKq/+g0L9qGV69vFylKZwNCrBsnXblZMU4=',
          proposer_address: 'IZR3WTn/klKSpH5juTYFPvGjlbk=',
          time: '2023-11-25T17:51:36.169991985Z',
          validators_hash: 'HkUtdy6sZwKq/+g0L9qGV69vFylKZwNCrBsnXblZMU4=',
          version: {
            app: '0',
            block: '11',
          },
        },
        last_commit: {
          block_id: {
            hash: 'Dhj1YWZKyIC8PHMX6tCQ6zLQB3MYsE5zFadiKKife/U=',
            part_set_header: {
              hash: 'K1cBu6KkD0HG9kNcYZGLMbyKr6uDheaCYRoxZVMo1RE=',
              total: 1,
            },
          },
          height: '2742',
          round: 0,
          signatures: [
            {
              block_id_flag: 'BLOCK_ID_FLAG_COMMIT',
              signature:
                'Vjuh+RXznsZoGpFKdlEDjCdlVVdcuHpcxoIu5QwKS1KBjgJeLI7nQlUM1i1vT046nrbRXgwnN1zWug/mBXzrAw==',
              timestamp: '2023-11-25T17:51:36.169991985Z',
              validator_address: 'IZR3WTn/klKSpH5juTYFPvGjlbk=',
            },
          ],
        },
      },
      block_id: {
        hash: 'rBMrk3hkeKX/qeqOMxwzVF7AnwUV8hKfGgoh/Ff2Wkc=',
        part_set_header: {
          hash: 'd4mokzrinDjxbBfXYUNgmR/nt9P0qeFEHubwU6PHXT8=',
          total: 1,
        },
      },
    },
  ],
  [
    '["http://localhost:1317/agoric/vstorage/data/published.wallet.agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq",{"keepalive":true,"headers":{"Content-Type":"application/json"}}]',
    {
      value:
        '{"blockHeight":"2741","values":["{\\"body\\":\\"#{\\\\\\"status\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"reserveAdd1\\\\\\",\\\\\\"invitationSpec\\\\\\":{\\\\\\"callPipe\\\\\\":[[\\\\\\"makeAddCollateralInvitation\\\\\\",[]]],\\\\\\"instancePath\\\\\\":[\\\\\\"reserve\\\\\\"],\\\\\\"source\\\\\\":\\\\\\"agoricContract\\\\\\"},\\\\\\"proposal\\\\\\":{\\\\\\"give\\\\\\":{\\\\\\"Collateral\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+10\\\\\\"}}},\\\\\\"result\\\\\\":\\\\\\"added Collateral to the Reserve\\\\\\"},\\\\\\"updated\\\\\\":\\\\\\"offerStatus\\\\\\"}\\",\\"slots\\":[\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"status\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"reserveAdd1\\\\\\",\\\\\\"invitationSpec\\\\\\":{\\\\\\"callPipe\\\\\\":[[\\\\\\"makeAddCollateralInvitation\\\\\\",[]]],\\\\\\"instancePath\\\\\\":[\\\\\\"reserve\\\\\\"],\\\\\\"source\\\\\\":\\\\\\"agoricContract\\\\\\"},\\\\\\"numWantsSatisfied\\\\\\":1,\\\\\\"proposal\\\\\\":{\\\\\\"give\\\\\\":{\\\\\\"Collateral\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+10\\\\\\"}}},\\\\\\"result\\\\\\":\\\\\\"added Collateral to the Reserve\\\\\\"},\\\\\\"updated\\\\\\":\\\\\\"offerStatus\\\\\\"}\\",\\"slots\\":[\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"status\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"reserveAdd1\\\\\\",\\\\\\"invitationSpec\\\\\\":{\\\\\\"callPipe\\\\\\":[[\\\\\\"makeAddCollateralInvitation\\\\\\",[]]],\\\\\\"instancePath\\\\\\":[\\\\\\"reserve\\\\\\"],\\\\\\"source\\\\\\":\\\\\\"agoricContract\\\\\\"},\\\\\\"numWantsSatisfied\\\\\\":1,\\\\\\"payouts\\\\\\":{\\\\\\"Collateral\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}},\\\\\\"proposal\\\\\\":{\\\\\\"give\\\\\\":{\\\\\\"Collateral\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+10\\\\\\"}}},\\\\\\"result\\\\\\":\\\\\\"added Collateral to the Reserve\\\\\\"},\\\\\\"updated\\\\\\":\\\\\\"offerStatus\\\\\\"}\\",\\"slots\\":[\\"board0257\\"]}"]}',
    },
  ],
]);
