import type { DepositFacet, IssuerKit, NatAmount, Purse } from '../src/ertp-types.js';

type Dollars = `$${string}`;
const numeral = (amt: Dollars) => amt.replace(/[$,]/g, '');

export const withAmountUtils = (kit: IssuerKit<'nat'>) => ({
  ...kit,
  amount: (value: bigint): NatAmount => ({ brand: kit.brand, value }),
  $: (amt: Dollars): NatAmount => ({ brand: kit.brand, value: BigInt(numeral(amt)) }),
  fund: (purse: Purse<'nat'>, value: bigint) =>
    purse.deposit(kit.mint.mintPayment({ brand: kit.brand, value })),
  fundDeposit: (deposit: DepositFacet<'nat'>, value: bigint) =>
    deposit.receive(kit.mint.mintPayment({ brand: kit.brand, value })),
});

export const ertpOnly = <T extends IssuerKit<'nat'>>(kit: T) => ({
  issuer: kit.issuer,
  brand: kit.brand,
  amount: (value: bigint): NatAmount => ({ brand: kit.brand, value }),
  $: (amt: Dollars): NatAmount => ({ brand: kit.brand, value: BigInt(numeral(amt)) }),
  mintRecoveryPurse: kit.mintRecoveryPurse,
  displayInfo: kit.displayInfo,
});
