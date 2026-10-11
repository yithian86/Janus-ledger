import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { IncomeService } from '../../core/services/income.service';
import { Income } from '../../core/models/income.model';
import { TableComponent, TableColumn, SortDirection } from '../../commons/components/table/table.component';
import { ButtonComponent } from '../../commons/components/button/button.component';
import { ModalComponent } from '../../commons/components/modal/modal.component';
import { InputComponent } from '../../commons/components/input/input.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';

type EntryMode = 'single' | 'monthly';

@Component({
  selector: 'pt-incomes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './incomes.component.html',
  styleUrl: './incomes.component.scss',
})
export class IncomesComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);
  private readonly fb = inject(FormBuilder);

  incomes: Income[] = [];
  filteredIncomes: Income[] = [];
  selectedYear = '';
  ledgerSource = '';
  ledgerSearch = '';
  ledgerSortKey: string | null = 'date';
  ledgerSortDirection: SortDirection = 'desc';
  modalOpen = false;
  editingIncome: Income | null = null;
  entryMode: EntryMode = 'single';

  readonly sourceSuggestions = ['Salary', 'Freelance', 'Online shop', 'T-shirt sales', 'Dividends', 'Other'];
  readonly columns: TableColumn<Income>[] = [
    { key: 'date', header: 'Date', sortable: true },
    { key: 'source', header: 'Source', sortable: true },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', numeric: true, sortable: true },
    { key: 'currency', header: 'Currency', numeric: true },
    { key: 'actions', header: 'ACTIONS' },
  ];

  form = this.fb.nonNullable.group({
    date: ['', Validators.required],
    start_date: [''],
    end_date: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['EUR', Validators.required],
    source: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
  });

  get yearOptions(): SelectOption[] {
    const years = [...new Set(this.incomes.map((income) => income.date.slice(0, 4)))].sort().reverse();
    return [{ value: '', label: 'All years' }, ...years.map((year) => ({ value: year, label: year }))];
  }

  get incomeSourceCount(): number {
    return new Set(this.filteredIncomes.map((income) => income.source)).size;
  }

  get incomeSources(): SelectOption[] {
    const sources = [...new Set(this.incomes.map((income) => income.source))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All sources' }, ...sources.map((source) => ({ value: source, label: source }))];
  }

  get currencyTotals(): { currency: string; amount: number }[] {
    const totals = this.filteredIncomes.reduce<Record<string, number>>((result, income) => {
      result[income.currency] = (result[income.currency] ?? 0) + income.amount;
      return result;
    }, {});
    return Object.entries(totals)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => ({ currency, amount }));
  }

  get ledgerIncomes(): Income[] {
    const search = this.ledgerSearch.trim().toLocaleLowerCase();
    const incomes = this.filteredIncomes.filter((income) => {
      const matchesSource = !this.ledgerSource || income.source === this.ledgerSource;
      const searchableText = [income.date, income.source, income.description, income.currency]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return matchesSource && (!search || searchableText.includes(search));
    });
    if (!this.ledgerSortKey || !this.ledgerSortDirection) return incomes;

    const direction = this.ledgerSortDirection === 'asc' ? 1 : -1;
    return [...incomes].sort((left, right) => {
      const leftValue = this.sortValue(left, this.ledgerSortKey!);
      const rightValue = this.sortValue(right, this.ledgerSortKey!);
      if (leftValue === rightValue) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return (leftValue < rightValue ? -1 : 1) * direction;
    });
  }

  ngOnInit() {
    this.incomeService.refresh().subscribe();
    this.incomeService.incomes$.subscribe((incomes) => {
      this.incomes = incomes;
      this.applyFilters();
    });
  }

  onLedgerSortChange(event: { key: string; direction: SortDirection }) {
    this.ledgerSortKey = event.direction ? event.key : null;
    this.ledgerSortDirection = event.direction;
  }

  private sortValue(income: Income, key: string): string | number | null {
    const value = income[key as keyof Income];
    if (value == null || value === '') return null;
    if (key === 'date') return Date.parse(String(value));
    if (typeof value === 'number') return value;
    return String(value).toLocaleLowerCase();
  }

  applyFilters() {
    this.filteredIncomes = this.incomes.filter((income) =>
      !this.selectedYear || income.date.startsWith(this.selectedYear)
    );
  }

  openCreate() {
    this.editingIncome = null;
    this.entryMode = 'single';
    this.form.reset({
      date: new Date().toISOString().slice(0, 10),
      start_date: '',
      end_date: '',
      amount: 0,
      currency: 'EUR',
      source: '',
      description: '',
    });
    this.modalOpen = true;
  }

  openEdit(income: Income) {
    this.editingIncome = income;
    this.entryMode = 'single';
    this.form.reset({
      date: income.date,
      start_date: '',
      end_date: '',
      amount: income.amount,
      currency: income.currency,
      source: income.source,
      description: income.description ?? '',
    });
    this.modalOpen = true;
  }

  duplicateIncome(income: Income) {
    this.editingIncome = null;
    this.entryMode = 'single';
    this.form.reset({
      date: new Date().toISOString().slice(0, 10),
      start_date: '',
      end_date: '',
      amount: income.amount,
      currency: income.currency,
      source: income.source,
      description: income.description ?? '',
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

  closeModal() {
    this.modalOpen = false;
  }

  save() {
    const payload = this.form.getRawValue();
    if (this.entryMode === 'monthly' && !this.editingIncome) {
      const { start_date: startDate, end_date: endDate } = payload;
      if (this.form.invalid || !startDate || !endDate || endDate < startDate) return;
      this.incomeService.createBatch({
        start_date: startDate,
        end_date: endDate,
        amount: payload.amount,
        currency: payload.currency,
        source: payload.source.trim(),
        description: payload.description,
      }).subscribe(() => this.closeModal());
      return;
    }
    if (this.form.invalid || !payload.date) return;
    const request$ = this.editingIncome
      ? this.incomeService.update(this.editingIncome.id, { ...payload, source: payload.source.trim() })
      : this.incomeService.create({ ...payload, source: payload.source.trim() });
    request$.subscribe(() => this.closeModal());
  }

  deleteIncome(income?: Income) {
    const target = income ?? this.editingIncome;
    if (!target) return;
    this.incomeService.delete(target.id).subscribe(() => {
      if (this.editingIncome?.id === target.id) this.closeModal();
    });
  }
}
