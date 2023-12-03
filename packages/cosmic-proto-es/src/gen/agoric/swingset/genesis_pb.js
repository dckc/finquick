// @generated by protoc-gen-es v1.5.0
// @generated from file agoric/swingset/genesis.proto (package agoric.swingset, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { proto3 } from "@bufbuild/protobuf";
import { Params, State } from "./swingset_pb.js";

/**
 * The initial or exported state.
 *
 * @generated from message agoric.swingset.GenesisState
 */
export const GenesisState = proto3.makeMessageType(
  "agoric.swingset.GenesisState",
  () => [
    { no: 2, name: "params", kind: "message", T: Params },
    { no: 3, name: "state", kind: "message", T: State },
    { no: 4, name: "swing_store_export_data", kind: "message", T: SwingStoreExportDataEntry, repeated: true },
  ],
);

/**
 * A SwingStore "export data" entry.
 *
 * @generated from message agoric.swingset.SwingStoreExportDataEntry
 */
export const SwingStoreExportDataEntry = proto3.makeMessageType(
  "agoric.swingset.SwingStoreExportDataEntry",
  () => [
    { no: 1, name: "key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "value", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ],
);
