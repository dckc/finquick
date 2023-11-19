import { Far, makeMarshal } from '@endo/marshal';

const makeTranslationTable = (
  makeSlot: (val: unknown, size: number) => unknown,
  makeVal: (slot: unknown, iface: string | undefined) => unknown,
) => {
  const valToSlot = new Map();
  const slotToVal = new Map();

  const convertValToSlot = (val: unknown) => {
    if (valToSlot.has(val)) return valToSlot.get(val);
    const slot = makeSlot(val, valToSlot.size);
    valToSlot.set(val, slot);
    slotToVal.set(slot, val);
    return slot;
  };

  const convertSlotToVal = (slot: unknown, iface: string | undefined) => {
    if (slot === null) return makeVal(slot, iface);
    if (slotToVal.has(slot)) return slotToVal.get(slot);
    const val = makeVal(slot, iface);
    valToSlot.set(val, slot);
    slotToVal.set(slot, val);
    return val;
  };

  return harden({ convertValToSlot, convertSlotToVal });
};

const synthesizeRemotable = (_slot: unknown, iface: string | undefined) =>
  Far((iface ?? '').replace(/^Alleged: /, ''), {});

const { convertValToSlot, convertSlotToVal } = makeTranslationTable(slot => {
  throw new Error(`unknown id: ${slot}`);
}, synthesizeRemotable);

export const makeClientMarshaller = () =>
  makeMarshal(convertValToSlot, convertSlotToVal, {
    serializeBodyFormat: 'smallcaps',
  });
