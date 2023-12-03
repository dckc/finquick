// @generated by protoc-gen-es v1.5.0
// @generated from file agoric/lien/genesis.proto (package agoric.lien, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";
import type { Lien } from "./lien_pb.js";

/**
 * The initial or exported state.
 *
 * @generated from message agoric.lien.GenesisState
 */
export declare class GenesisState extends Message<GenesisState> {
  /**
   * @generated from field: repeated agoric.lien.AccountLien liens = 1;
   */
  liens: AccountLien[];

  constructor(data?: PartialMessage<GenesisState>);

  static readonly runtime: typeof proto3;
  static readonly typeName = "agoric.lien.GenesisState";
  static readonly fields: FieldList;

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GenesisState;

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GenesisState;

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GenesisState;

  static equals(a: GenesisState | PlainMessage<GenesisState> | undefined, b: GenesisState | PlainMessage<GenesisState> | undefined): boolean;
}

/**
 * The lien on a particular account
 *
 * @generated from message agoric.lien.AccountLien
 */
export declare class AccountLien extends Message<AccountLien> {
  /**
   * Account address, bech32-encoded.
   *
   * @generated from field: string address = 1;
   */
  address: string;

  /**
   * The liened amount. Should be nonzero.
   *
   * @generated from field: agoric.lien.Lien lien = 2;
   */
  lien?: Lien;

  constructor(data?: PartialMessage<AccountLien>);

  static readonly runtime: typeof proto3;
  static readonly typeName = "agoric.lien.AccountLien";
  static readonly fields: FieldList;

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AccountLien;

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AccountLien;

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AccountLien;

  static equals(a: AccountLien | PlainMessage<AccountLien> | undefined, b: AccountLien | PlainMessage<AccountLien> | undefined): boolean;
}
