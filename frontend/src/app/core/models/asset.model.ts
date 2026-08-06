export type AssetType = 'stock' | 'etf' | 'bond' | 'cash' | 'crypto';

export interface Asset {
  id: number;
  ticker: string;
  name: string;
  asset_type: AssetType;
  currency: string;
  exchange?: string | null;
  isin?: string | null;
  notes?: string | null;
  archived: boolean;
}

export type AssetCreate = Omit<Asset, 'id' | 'archived'>;
export type AssetUpdate = Partial<AssetCreate> & { archived?: boolean };
