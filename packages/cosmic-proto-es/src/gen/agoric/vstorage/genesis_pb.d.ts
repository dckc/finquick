// @generated by protoc-gen-es v1.5.0
// @generated from file agoric/vstorage/genesis.proto (package agoric.vstorage, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";

/**
 * The initial or exported state.
 *
 * @generated from message agoric.vstorage.GenesisState
 */
export declare class GenesisState extends Message<GenesisState> {
  /**
   * @generated from field: repeated agoric.vstorage.DataEntry data = 1;
   */
  data: DataEntry[];

  constructor(data?: PartialMessage<GenesisState>);

  static readonly runtime: typeof proto3;
  static readonly typeName = "agoric.vstorage.GenesisState";
  static readonly fields: FieldList;

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GenesisState;

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GenesisState;

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GenesisState;

  static equals(a: GenesisState | PlainMessage<GenesisState> | undefined, b: GenesisState | PlainMessage<GenesisState> | undefined): boolean;
}

/**
 * A vstorage entry.  The only necessary entries are those with data, as the
 * ancestor nodes are reconstructed on import.
 *
 * @generated from message agoric.vstorage.DataEntry
 */
export declare class DataEntry extends Message<DataEntry> {
  /**
   * A "."-separated path with individual path elements matching
   * `[-_A-Za-z0-9]+`
   *
   * @generated from field: string path = 1;
   */
  path: string;

  /**
   * @generated from field: string value = 2;
   */
  value: string;

  constructor(data?: PartialMessage<DataEntry>);

  static readonly runtime: typeof proto3;
  static readonly typeName = "agoric.vstorage.DataEntry";
  static readonly fields: FieldList;

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DataEntry;

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DataEntry;

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DataEntry;

  static equals(a: DataEntry | PlainMessage<DataEntry> | undefined, b: DataEntry | PlainMessage<DataEntry> | undefined): boolean;
}
