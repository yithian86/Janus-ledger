import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ExpenseService } from '../../core/services/expense.service';
import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '../../core/models/expense.model';
import { TableComponent, TableColumn, SortDirection } from '../../commons/components/table/table.component';
import { ButtonComponent } from '../../commons/components/button/button.component';
import { ModalComponent } from '../../commons/components/modal/modal.component';
import { InputComponent } from '../../commons/components/input/input.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';

type ViewMode = 'month' | 'year';
type EntryMode = 'single' | 'monthly';

@Component({
  selector: 'pt-expenses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxEchartsDirective,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly fb = inject(FormBuilder);

  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];
  viewMode: ViewMode = 'month';
  selectedYear = '';
  ledgerCategory = '';
  ledgerSearch = '';
  ledgerSortKey: string | null = 'date';
  ledgerSortDirection: SortDirection = 'desc';
  modalOpen = false;
  editingExpense: Expense | null = null;
  entryMode: EntryMode = 'single';
  readonly subcategorySuggestions = ['Electricity', 'Gas', 'Water', 'Stamp Duty', 'Train', 'Mobile phone bill'];
  trendChart?: EChartsOption;
  categoryChart?: EChartsOption;
  expandedCategoryChart?: EChartsOption;
  expandedChart: 'trend' | 'category' | null = null;

  readonly categoryOptions: SelectOption[] = [
    { value: '', label: 'All categories' },
    ...EXPENSE_CATEGORIES.map((category) => ({ value: category.value, label: `${category.group} · ${category.label}` })),
  ];
  get yearOptions(): SelectOption[] {
    const years = [...new Set(this.expenses.map((expense) => expense.date.slice(0, 4)))].sort().reverse();
    return [{ value: '', label: 'All years' }, ...years.map((year) => ({ value: year, label: year }))];
  }
  readonly formCategoryOptions = EXPENSE_CATEGORIES.map((category) => ({
    value: category.value,
    label: `${category.group} · ${category.label}`,
  }));

  columns: TableColumn<Expense>[] = [
    { key: 'date', header: 'Date', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'subcategory', header: 'Subcategory', sortable: true },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', numeric: true, sortable: true },
    { key: 'currency', header: 'Currency', numeric: true },
    { key: 'actions', header: 'ACTIONS' },
  ];

  form = this.fb.nonNullable.group({
    date: [''],
    start_date: [''],
    end_date: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['EUR', Validators.required],
    category: ['groceries', Validators.required],
    subcategory: [''],
    description: [''],
  });

  ngOnInit() {
    this.expenseService.refresh().subscribe();
    this.expenseService.expenses$.subscribe((expenses) => {
      this.expenses = expenses;
      this.applyFilters();
    });
  }

  get total(): number {
    return this.filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  get averagePeriod(): number {
    const periods = new Set(this.filteredExpenses.map((expense) => this.periodKey(expense.date))).size;
    return periods ? this.total / periods : 0;
  }

  get topCategory(): string {
    const totals = this.categoryTotals(this.filteredExpenses);
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    return top ? EXPENSE_CATEGORY_LABELS[top[0]] : '—';
  }

  get ledgerExpenses(): Expense[] {
    const search = this.ledgerSearch.trim().toLocaleLowerCase();
    const expenses = this.filteredExpenses.filter((expense) => {
      const matchesCategory = !this.ledgerCategory || expense.category === this.ledgerCategory;
      const searchableText = [
        expense.date,
        expense.category,
        this.categoryLabel(expense.category),
        expense.subcategory,
        expense.description,
        expense.currency,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return matchesCategory && (!search || searchableText.includes(search));
    });
    if (!this.ledgerSortKey || !this.ledgerSortDirection) return expenses;

    const direction = this.ledgerSortDirection === 'asc' ? 1 : -1;
    return [...expenses].sort((left, right) => {
      const leftValue = this.ledgerSortValue(left, this.ledgerSortKey!);
      const rightValue = this.ledgerSortValue(right, this.ledgerSortKey!);
      if (leftValue === rightValue) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return (leftValue < rightValue ? -1 : 1) * direction;
    });
  }

  onLedgerSortChange(event: { key: string; direction: SortDirection }) {
    this.ledgerSortKey = event.direction ? event.key : null;
    this.ledgerSortDirection = event.direction;
  }

  private ledgerSortValue(expense: Expense, key: string): string | number | null {
    const value = expense[key as keyof Expense];
    if (value == null || value === '') return null;
    if (key === 'date') return Date.parse(String(value));
    if (typeof value === 'number') return value;
    return String(value).toLocaleLowerCase();
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.applyFilters();
  }

  openExpandedChart(chart: 'trend' | 'category') {
    this.expandedChart = chart;
  }

  closeExpandedChart() {
    this.expandedChart = null;
  }

  applyFilters() {
    this.filteredExpenses = this.expenses.filter((expense) => {
      const matchesYear = !this.selectedYear || expense.date.startsWith(this.selectedYear);
      return matchesYear;
    });
    this.buildCharts();
  }

  openCreate() {
    this.editingExpense = null;
    this.entryMode = 'single';
    this.form.reset({
      date: new Date().toISOString().slice(0, 10),
      start_date: '',
      end_date: '',
      amount: 0,
      currency: 'EUR',
      category: 'groceries',
      subcategory: '',
      description: '',
    });
    this.modalOpen = true;
  }

  setEntryMode(mode: EntryMode) {
    this.entryMode = mode;
    if (mode === 'monthly' && !this.form.value.start_date) {
      const today = new Date().toISOString().slice(0, 10);
      this.form.patchValue({ start_date: today, end_date: today });
    }
  }

  openEdit(expense: Expense) {
    this.editingExpense = expense;
    this.form.reset({
      date: expense.date,
      start_date: '',
      end_date: '',
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      subcategory: expense.subcategory ?? '',
      description: expense.description ?? '',
    });
    this.modalOpen = true;
  }

  duplicateExpense(expense: Expense) {
    this.editingExpense = null;
    this.entryMode = 'single';
    this.form.reset({
      date: expense.date,
      start_date: '',
      end_date: '',
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      subcategory: expense.subcategory ?? '',
      description: expense.description ?? '',
    });
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  save() {
    const payload = this.form.getRawValue();
    if (this.entryMode === 'monthly' && !this.editingExpense) {
      const startDate = payload.start_date;
      const endDate = payload.end_date;
      if (this.form.invalid || !startDate || !endDate || endDate < startDate) return;
      this.expenseService.createBatch({
        start_date: startDate,
        end_date: endDate,
        amount: payload.amount,
        currency: payload.currency,
        category: payload.category,
        subcategory: payload.subcategory,
        description: '',
      }).subscribe(() => this.closeModal());
      return;
    }
    if (this.form.invalid || !payload.date) return;
    const request$ = this.editingExpense
      ? this.expenseService.update(this.editingExpense.id, payload)
      : this.expenseService.create(payload);
    request$.subscribe(() => this.closeModal());
  }

  deleteExpense(expense?: Expense) {
    const target = expense ?? this.editingExpense;
    if (!target) return;
    this.expenseService.delete(target.id).subscribe(() => {
      if (this.editingExpense?.id === target.id) this.closeModal();
    });
  }

  categoryLabel(category: string): string {
    return EXPENSE_CATEGORY_LABELS[category] ?? category;
  }

  private periodKey(date: string): string {
    return this.viewMode === 'year' ? date.slice(0, 4) : date.slice(0, 7);
  }

  private categoryTotals(expenses: Expense[]): Record<string, number> {
    return expenses.reduce<Record<string, number>>((totals, expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
      return totals;
    }, {});
  }

  private buildCharts() {
    const periods = this.filteredExpenses.reduce<Record<string, number>>((totals, expense) => {
      const period = this.periodKey(expense.date);
      totals[period] = (totals[period] ?? 0) + expense.amount;
      return totals;
    }, {});
    const sortedPeriods = Object.keys(periods).sort();
    const palette = ['#2B6E64', '#7B8F87', '#C08A5A', '#8D6E97', '#B23B3B', '#3C7399'];

    this.trendChart = {
      tooltip: { trigger: 'axis', valueFormatter: (value) => `€${Number(value).toFixed(2)}` },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      grid: { left: 48, right: 20, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: sortedPeriods },
      yAxis: { type: 'value', axisLabel: { formatter: '€{value}' } },
      series: [{
        name: 'Expenses',
        type: 'bar',
        data: sortedPeriods.map((period) => Number(periods[period].toFixed(2))),
        itemStyle: { color: '#2B6E64', borderRadius: [4, 4, 0, 0] },
      }],
    };

    this.categoryChart = this.buildCategoryChart(false);
    this.expandedCategoryChart = this.buildCategoryChart(true);
  }

  private buildCategoryChart(showPercent: boolean): EChartsOption {
    const categories = this.categoryTotals(this.filteredExpenses);
    const palette = ['#2B6E64', '#7B8F87', '#C08A5A', '#8D6E97', '#B23B3B', '#3C7399'];
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = Array.isArray(params) ? params[0] : params;
          return `<strong>${data.name}</strong>: €${Number(data.value).toFixed(2)} (${Number(data.percent ?? 0).toFixed(1)}%)`;
        },
      },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      legend: { type: 'scroll', bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['42%', '72%'],
        itemStyle: { borderColor: '#F5F6F4', borderWidth: 2 },
        label: {
          position: showPercent ? 'inside' : 'outside',
          color: showPercent ? '#FFFFFF' : undefined,
          fontWeight: showPercent ? 600 : undefined,
          formatter: showPercent
            ? (params: any) => `${params.name}\n${Number(params.percent ?? 0).toFixed(1)}%`
            : '{b}',
        },
        data: Object.entries(categories).map(([name, value], index) => ({
          name: this.categoryLabel(name),
          value: Number(value.toFixed(2)),
          itemStyle: { color: palette[index % palette.length] },
        })),
      }],
    };
  }
}
