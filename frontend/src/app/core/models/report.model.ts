import { AssetType } from './asset.model';

export interface Holding {
  asset_id: number;
  ticker: string;
  name: string;
  asset_type: AssetType;
  currency: string;
  quantity: number;
  avg_cost: number;
  cost_basis_base: number;
  current_price?: number | null;
  market_value_base?: number | null;
  unrealized_gain_base?: number | null;
  unrealized_gain_percentage?: number | null;
}

export interface RealizedGain {
  year: number;
  asset_id: number;
  ticker: string;
  proceeds_base: number;
  cost_basis_base: number;
  fees_base: number;
  realized_gain_base: number;
}

export interface CashFlowPeriod {
  period: string;
  invested_base: number;
  divested_base: number;
  income_base: number;
  fees_base: number;
  deposits_base: number;
  withdrawals_base: number;
  net_flow_base: number;
}

export interface IncomeByPeriod {
  period: string;
  asset_id: number;
  ticker: string;
  income_base: number;
}

export type Granularity = 'month' | 'year';
