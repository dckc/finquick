// @generated by protoc-gen-es v1.5.0
// @generated from file agoric/vstorage/vstorage.proto (package agoric.vstorage, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { proto3 } from "@bufbuild/protobuf";

/**
 * Data is the vstorage node data.
 *
 * @generated from message agoric.vstorage.Data
 */
export const Data = proto3.makeMessageType(
  "agoric.vstorage.Data",
  () => [
    { no: 1, name: "value", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ],
);

/**
 * Children are the immediate names (just one level deep) of subnodes leading to
 * more data from a given vstorage node.
 *
 * @generated from message agoric.vstorage.Children
 */
export const Children = proto3.makeMessageType(
  "agoric.vstorage.Children",
  () => [
    { no: 1, name: "children", kind: "scalar", T: 9 /* ScalarType.STRING */, repeated: true },
  ],
);

