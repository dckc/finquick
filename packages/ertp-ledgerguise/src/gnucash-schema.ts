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
