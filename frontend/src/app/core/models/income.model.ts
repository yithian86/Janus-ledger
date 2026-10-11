export interface Income {
  id: number;
  date: string;
  amount: number;
  currency: string;
  source: string;
  description?: string | null;
}

export type IncomeCreate = Omit<Income, 'id'>;
export type IncomeUpdate = Partial<IncomeCreate>;
