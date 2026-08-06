import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AssetService } from '../../core/services/asset.service';
import { Asset, AssetType } from '../../core/models/asset.model';
import { TableComponent, TableColumn } from '../../commons/components/table/table.component';
import { ButtonComponent } from '../../commons/components/button/button.component';
import { ModalComponent } from '../../commons/components/modal/modal.component';
import { InputComponent } from '../../commons/components/input/input.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';
import { BadgeComponent } from '../../commons/components/badge/badge.component';

const ASSET_TYPE_OPTIONS: SelectOption[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'etc', label: 'ETC' },
  { value: 'bond', label: 'Bond' },
  { value: 'cash', label: 'Cash' },
  { value: 'crypto', label: 'Crypto' },
];

@Component({
  selector: 'pt-assets',
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
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
})
export class AssetsComponent implements OnInit {
  private readonly assetService = inject(AssetService);
  private readonly fb = inject(FormBuilder);

  assets: Asset[] = [];
  assetTypeOptions = ASSET_TYPE_OPTIONS;
  modalOpen = false;
  editingAsset: Asset | null = null;

  columns: TableColumn<Asset>[] = [
    { key: 'ticker', header: 'Ticker', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'asset_type', header: 'Type', sortable: true },
    { key: 'currency', header: 'Currency', numeric: true, sortable: true },
    { key: 'exchange', header: 'Exchange', sortable: true },
  ];

  // Original unsorted assets from the service — used to reset sorting.
  private originalAssets: Asset[] = [];

  // Sorting state bound to the table
  sortKey: string | null = null;
  sortDirection: 'asc' | 'desc' | null = null;

  form = this.fb.nonNullable.group({
    ticker: ['', Validators.required],
    name: ['', Validators.required],
    asset_type: ['stock' as AssetType, Validators.required],
    currency: ['EUR', Validators.required],
    exchange: [''],
    isin: [''],
  });

  ngOnInit() {
    this.assetService.refresh().subscribe();
    this.assetService.assets$.subscribe((assets) => {
      this.originalAssets = assets;
      this.applySort();
    });
  }

  openCreate() {
    this.editingAsset = null;
    this.form.reset({ ticker: '', name: '', asset_type: 'stock', currency: 'EUR', exchange: '', isin: '' });
    this.modalOpen = true;
  }

  openEdit(asset: Asset) {
    this.editingAsset = asset;
    this.form.reset({
      ticker: asset.ticker,
      name: asset.name,
      asset_type: asset.asset_type,
      currency: asset.currency,
      exchange: asset.exchange ?? '',
      isin: asset.isin ?? '',
    });
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  save() {
    if (this.form.invalid) return;
    const payload = this.form.getRawValue();
    const request$ = this.editingAsset
      ? this.assetService.update(this.editingAsset.id, payload)
      : this.assetService.create(payload);
    request$.subscribe(() => this.closeModal());
  }

  onSortChange(event: { key: string; direction: 'asc' | 'desc' | null }) {
    this.sortKey = event.direction ? event.key : null;
    this.sortDirection = event.direction;
    this.applySort();
  }

  private applySort() {
    if (!this.sortKey || !this.sortDirection) {
      this.assets = [...this.originalAssets];
      return;
    }

    const key = this.sortKey;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.assets = [...this.originalAssets].sort((a, b) => {
      const va = (a as Record<string, any>)[key];
      const vb = (b as Record<string, any>)[key];

      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;

      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }

      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sa < sb ? -1 * dir : sa > sb ? 1 * dir : 0;
    });
  }
}
