export interface Expense {
  id: number;
  date: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string | null;
  description?: string | null;
}

export type ExpenseCreate = Omit<Expense, 'id'>;
export type ExpenseUpdate = Partial<ExpenseCreate>;

export interface ExpenseCategory {
  value: string;
  label: string;
  group: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { value: 'house', label: 'House', group: 'Housing' },
  { value: 'condo', label: 'Condo', group: 'Housing' },
  { value: 'groceries', label: 'Groceries', group: 'Essentials' },
  { value: 'utilities', label: 'Utilities', group: 'Essentials' },
  { value: 'health', label: 'Health', group: 'Essentials' },
  { value: 'transportation', label: 'Transportation', group: 'Transport & services' },
  { value: 'fees', label: 'Fees', group: 'Transport & services' },
  { value: 'services', label: 'Services', group: 'Transport & services' },
  { value: 'leisure', label: 'Leisure', group: 'Lifestyle' },
  { value: 'gifts', label: 'Gifts', group: 'Lifestyle' },
  { value: 'holidays', label: 'Holidays', group: 'Lifestyle' },
  { value: 'clothing', label: 'Clothing', group: 'Lifestyle' },
  { value: 'out', label: 'Out & dining', group: 'Lifestyle' },
  { value: 'other', label: 'Other', group: 'Other' },
];

export const EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label])
) as Record<string, string>;
