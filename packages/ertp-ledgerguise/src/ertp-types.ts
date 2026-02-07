import type {
  CopyBag,
  CopySet,
  ERef,
  Key,
  LatestTopic,
  Pattern,
  RemotableObject,
} from './endo-types.js';

// #region from @agoric/internal
declare const tag: 'Symbol(tag)';
type TagContainer<Token> = {
  readonly [tag]: Token;
};
type Tag<Token extends PropertyKey, TagMetadata> = TagContainer<{
  [K in Token]: TagMetadata;
}>;
type Tagged<Type, TagName extends PropertyKey, TagMetadata = never> = Type &
  Tag<TagName, TagMetadata>;

type TypeTag<T, TN extends PropertyKey, M> = Tagged<T, TN, M>;
// #endregion from @agoric/internal

export type AssetKind = 'nat' | 'set' | 'copySet' | 'copyBag';

export type NatAmount = {
  brand: Brand<'nat'>;
  value: bigint;
};

export type SetAmount<K extends Key> = {
  brand: Brand<'set'>;
  value: K[];
};

export type CopySetAmount<K extends Key> = {
  brand: Brand<'copySet'>;
  value: CopySet<K>;
};

export type CopyBagAmount<K extends Key> = {
  brand: Brand<'copyBag'>;
  value: CopyBag<K>;
};

export type AnyAmount = {
  brand: Brand<any>;
  value: any;
};

export type Amount<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = K extends 'nat'
  ? NatAmount
  : K extends 'set'
  ? SetAmount<M>
  : K extends 'copySet'
  ? CopySetAmount<M>
  : K extends 'copyBag'
  ? CopyBagAmount<M>
  : AnyAmount;

export type NatValue = bigint;
export type SetValue<K extends Key = Key> = K[];

export type AssetValueForKind<
  K extends AssetKind,
  M extends Key = Key,
> = K extends 'nat'
  ? NatValue
  : K extends 'set'
  ? SetValue<M>
  : K extends 'copySet'
  ? CopySet<M>
  : K extends 'copyBag'
  ? CopyBag<M>
  : never;

type BrandMethods<K extends AssetKind> = {
  isMyIssuer: (allegedIssuer: ERef<Issuer<K>>) => Promise<boolean>;
  getAllegedName: () => string;
  getDisplayInfo: () => DisplayInfo<K>;
  getAmountShape: () => Pattern;
};

export type Brand<K extends AssetKind = AssetKind> = RemotableObject &
  BrandMethods<K>;

type IssuerIsLive = (payment: ERef<Payment>) => Promise<boolean>;
type IssuerGetAmountOf<K extends AssetKind, M extends Key = Key> = (
  payment: ERef<Payment<K, M>>,
) => Promise<Amount<K, M>>;
type IssuerBurn = (
  payment: ERef<Payment>,
  optAmountShape?: Pattern,
) => Promise<Amount>;

type IssuerMethods<K extends AssetKind, M extends Key> = {
  getBrand: () => Brand<K>;
  getAllegedName: () => string;
  getAssetKind: () => K;
  getDisplayInfo: () => DisplayInfo<K>;
  makeEmptyPurse: () => Purse<K, M>;
  isLive: IssuerIsLive;
  getAmountOf: IssuerGetAmountOf<K, M>;
  burn: IssuerBurn;
};

export type Issuer<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = RemotableObject & IssuerMethods<K, M>;

export type Mint<K extends AssetKind = AssetKind, M extends Key = Key> = {
  getIssuer: () => Issuer<K, M>;
  mintPayment: (newAmount: Amount<K>) => Payment<K, M>;
};

export type IssuerKit<K extends AssetKind = AssetKind, M extends Key = Key> = {
  mint: Mint<K, M>;
  mintRecoveryPurse: Purse<K, M>;
  issuer: Issuer<K, M>;
  brand: Brand<K>;
  displayInfo: DisplayInfo;
};

type DepositFacetReceive<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = (payment: Payment<K, M>, optAmountShape?: Pattern) => Amount<K, M>;
export type DepositFacet<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = {
  receive: DepositFacetReceive<K, M>;
};

export type Purse<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = RemotableObject & PurseMethods<K, M>;

type PurseMethods<K extends AssetKind = AssetKind, M extends Key = Key> = {
  getAllegedBrand: () => Brand<K>;
  getCurrentAmount: () => Amount<K, M>;
  getCurrentAmountNotifier: () => LatestTopic<Amount<K, M>>;
  deposit: <P extends Payment<K, M>>(
    payment: P,
    optAmountShape?: Pattern,
  ) => P extends Payment<K, M> ? Amount<K, M> : never;
  getDepositFacet: () => DepositFacet<K, M>;
  withdraw: (amount: Amount<K, M>) => Payment<K, M>;
  getRecoverySet: () => CopySet<Payment<K, M>>;
  recoverAll: () => Amount<K, M>;
};

export type Payment<
  K extends AssetKind = AssetKind,
  M extends Key = Key,
> = RemotableObject &
  TypeTag<
    {
      getAllegedBrand: () => Brand<K>;
    },
    'Set-like value type',
    M
  >;

export type DisplayInfo<K extends AssetKind = AssetKind> = {
  decimalPlaces?: number | undefined;
  assetKind: K;
};
