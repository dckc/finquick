export const SLOT_TYPE_GUID = 5;
export const SLOT_TYPE_STRING = 4;

export type SlotRow = {
  id: number;
  obj_guid: string;
  name: string;
  slot_type: number;
  int64_val: string | null;
  string_val: string | null;
  double_val: number | null;
  timespec_val: string | null;
  guid_val: string | null;
  numeric_val_num: string | null;
  numeric_val_denom: string | null;
  gdate_val: string | null;
};

export type TransactionRow = {
  guid: string;
  currency_guid: string;
  num: string;
  post_date: string | null;
  enter_date: string | null;
  description: string;
};

export type SplitRow = {
  guid: string;
  tx_guid: string;
  account_guid: string;
  memo: string;
  action: string;
  reconcile_state: string;
  reconcile_date: string | null;
  value_num: string;
  value_denom: string;
  quantity_num: string;
  quantity_denom: string;
};

export type AccountRow = {
  guid: string;
  name: string;
  account_type: string;
  commodity_guid: string;
  parent_guid: string | null;
  code: string | null;
  description: string | null;
  placeholder: number;
  hidden: number;
};

export type BooksRow = {
  root_account_guid: string;
};
