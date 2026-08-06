export type TransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'coupon'
  | 'deposit'
  | 'withdrawal'
  | 'fee';

export interface Transaction {
  id: number;
  asset_id: number;
  transaction_type: TransactionType;
  date: string; // ISO date, e.g. "2026-01-15"
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fees: number;
  currency: string;
  reinvested: boolean;
  notes?: string | null;
}

export type TransactionCreate = Omit<Transaction, 'id'>;
export type TransactionUpdate = Partial<TransactionCreate>;

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  coupon: 'Coupon',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  fee: 'Fee',
};
