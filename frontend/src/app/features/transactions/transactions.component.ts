import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AssetService } from '../../core/services/asset.service';
import { TransactionService } from '../../core/services/transaction.service';
import { Asset } from '../../core/models/asset.model';
import {
  Transaction,
  TransactionCreate,
  TransactionType,
  TRANSACTION_TYPE_LABELS,
} from '../../core/models/transaction.model';
import { TableComponent, TableColumn } from '../../commons/components/table/table.component';
import { ButtonComponent } from '../../commons/components/button/button.component';
import { ModalComponent } from '../../commons/components/modal/modal.component';
import { InputComponent } from '../../commons/components/input/input.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';
import { BadgeComponent, BadgeTone } from '../../commons/components/badge/badge.component';

const TRANSACTION_TYPE_OPTIONS: SelectOption[] = Object.entries(TRANSACTION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

const BADGE_TONE_BY_TYPE: Record<TransactionType, BadgeTone> = {
  buy: 'accent',
  sell: 'neutral',
  dividend: 'gain',
  coupon: 'gain',
  deposit: 'accent',
  withdrawal: 'loss',
  fee: 'loss',
  stamp_duty: 'loss',
};

interface TransactionRow extends Transaction {
  assetLabel: string;
}

@Component({
  selector: 'pt-transactions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    InputComponent,
    SelectComponent,
    BadgeComponent,
  ],
  templateUrl: './transactions.component.html',
  styleUrl: '../assets/assets.component.scss',
})
export class TransactionsComponent implements OnInit {
  private readonly assetService = inject(AssetService);
  private readonly transactionService = inject(TransactionService);
  private readonly fb = inject(FormBuilder);

  assets: Asset[] = [];
  transactions: Transaction[] = [];
  rows: TransactionRow[] = [];
  assetOptions: SelectOption[] = [];
  typeOptions = TRANSACTION_TYPE_OPTIONS;
  sortKey: string | null = 'date';
  sortDirection: 'asc' | 'desc' | null = 'desc';

  modalOpen = false;
  editingTxn: Transaction | null = null;

  columns: TableColumn<TransactionRow>[] = [
    { key: 'date', header: 'Date', sortable: true },
    { key: 'assetLabel', header: 'Asset' },
    { key: 'transaction_type', header: 'Type' },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'price', header: 'Price', numeric: true },
    { key: 'amount', header: 'Amount', numeric: true },
    { key: 'fees', header: 'Fees', numeric: true },
    { key: 'currency', header: 'Ccy' },
  ];

  form = this.fb.nonNullable.group({
    asset_id: ['', Validators.required],
    transaction_type: ['buy' as TransactionType, Validators.required],
    date: ['', Validators.required],
    quantity: [null as number | null],
    price: [null as number | null],
    amount: [null as number | null],
    fees: [0],
    currency: ['EUR', Validators.required],
    reinvested: [false],
    notes: [''],
  });

  get showAsset() {
    return !['fee', 'stamp_duty'].includes(this.form.controls.transaction_type.value);
  }
  get showQuantityPrice() {
    return ['buy', 'sell'].includes(this.form.controls.transaction_type.value);
  }
  get showAmount() {
    return !this.showQuantityPrice && !['fee', 'stamp_duty'].includes(this.form.controls.transaction_type.value);
  }
  get currencySuffix() {
    return this.form.controls.currency.value;
  }

  ngOnInit() {
    this.assetService.refresh().subscribe();
    this.assetService.assets$.subscribe((assets) => {
      this.assets = assets;
      this.assetOptions = assets.map((a) => ({ value: a.id, label: `${a.ticker} — ${a.name}` }));
      this.rebuildRows();
    });

    this.transactionService.refresh().subscribe();
    this.transactionService.transactions$.subscribe((txns) => {
      this.transactions = txns;
      this.rebuildRows();
    });

    this.form.controls.transaction_type.valueChanges.subscribe(() => this.updateAssetValidators());
    this.updateAssetValidators();
  }

  private rebuildRows() {
    const assetById = new Map(this.assets.map((a) => [a.id, a]));
    this.rows = this.transactions.map((t) => ({
      ...t,
      assetLabel:
        t.asset_id != null
          ? assetById.get(t.asset_id)?.name ?? `#${t.asset_id}`
          : 'N/A',
    }));
    this.applySort();
  }

  private applySort() {
    if (this.sortKey !== 'date') {
      return;
    }

    const directionFactor = this.sortDirection === 'asc' ? 1 : -1;
    this.rows = [...this.rows].sort((a, b) => {
      const aDate = this.getDateValue(a.date);
      const bDate = this.getDateValue(b.date);
      if (aDate === bDate) return 0;
      return (aDate > bDate ? 1 : -1) * directionFactor;
    });
  }

  private getDateValue(value: string | null | undefined) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  onSortChange({ key, direction }: { key: string; direction: 'asc' | 'desc' | null }) {
    this.sortKey = key;
    this.sortDirection = direction;
    this.applySort();
  }

  typeLabel(type: TransactionType) {
    return TRANSACTION_TYPE_LABELS[type];
  }
  badgeTone(type: TransactionType) {
    return BADGE_TONE_BY_TYPE[type];
  }

  openCreate() {
    this.editingTxn = null;
    this.form.reset({
      asset_id: '',
      transaction_type: 'buy',
      date: '',
      quantity: null,
      price: null,
      amount: null,
      fees: 0,
      currency: 'EUR',
      reinvested: false,
      notes: '',
    });
    this.modalOpen = true;
  }

  openEdit(row: TransactionRow) {
    this.editingTxn = row;
    this.form.reset({
      asset_id: row.asset_id != null ? String(row.asset_id) : '',
      transaction_type: row.transaction_type,
      date: row.date,
      quantity: row.quantity ?? null,
      price: row.price ?? null,
      amount: row.amount ?? null,
      fees: row.fees,
      currency: row.currency,
      reinvested: row.reinvested,
      notes: row.notes ?? '',
    });
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  private updateAssetValidators() {
    const assetControl = this.form.controls.asset_id;
    if (this.showAsset) {
      assetControl.setValidators([Validators.required]);
    } else {
      assetControl.clearValidators();
      assetControl.setValue('');
    }
    assetControl.updateValueAndValidity({ onlySelf: true });
  }

  save() {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const payload: TransactionCreate = {
      transaction_type: raw.transaction_type,
      date: raw.date,
      quantity: raw.quantity,
      price: raw.price,
      amount: raw.amount,
      fees: raw.fees,
      currency: raw.currency,
      reinvested: raw.reinvested,
      notes: raw.notes,
      ...(raw.asset_id !== '' ? { asset_id: Number(raw.asset_id) } : {}),
    };

    const request$ = this.editingTxn
      ? this.transactionService.update(this.editingTxn.id, payload)
      : this.transactionService.create(payload);
    request$.subscribe(() => this.closeModal());
  }
}
