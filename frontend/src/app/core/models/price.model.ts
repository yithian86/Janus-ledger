export interface PriceSnapshot {
  id: number;
  asset_id: number;
  date: string;
  price: number;
}

export type PriceSnapshotCreate = Omit<PriceSnapshot, 'id'>;

export interface FxRate {
  id: number;
  currency: string;
  date: string;
  rate_to_base: number;
}

export type FxRateCreate = Omit<FxRate, 'id'>;
