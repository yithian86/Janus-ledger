import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ReportService } from '../../core/services/report.service';
import { Holding } from '../../core/models/report.model';
import { TableComponent, TableColumn, SortDirection } from '../../commons/components/table/table.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';

@Component({
  selector: 'pt-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, TableComponent, SelectComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  holdings: Holding[] = [];
  filteredHoldings: Holding[] = [];
  selectedAssetType = '';
  assetTypeOptions: SelectOption[] = [
    { value: '', label: 'All types' },
    { value: 'stock', label: 'Stock' },
    { value: 'etf', label: 'ETF' },
    { value: 'etc', label: 'ETC' },
    { value: 'bond', label: 'Bond' },
    { value: 'cash', label: 'Cash' },
    { value: 'crypto', label: 'Crypto' },
  ];
  sortKey: string | null = 'asset_type';
  sortDirection: SortDirection = 'asc';

  totalValue = 0;
  totalCost = 0;
  totalUnrealized = 0;
  isLoading = false;
  lastRefreshed?: Date;

  allocationChart?: EChartsOption;
  holdingChart?: EChartsOption;

  columns: TableColumn<Holding>[] = [
    { key: 'ticker', header: 'Ticker' },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'asset_type', header: 'Type', sortable: true },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'avg_cost', header: 'Avg cost', numeric: true },
    { key: 'current_price', header: 'Price', numeric: true },
    { key: 'market_value_base', header: 'Value (€)', numeric: true },
    { key: 'unrealized_gain_base', header: 'Unrealized gain', numeric: true },
  ];

  ngOnInit() {
    this.loadData();
  }


  loadData(forceFetch: boolean = false) {
    this.isLoading = true;
    this.reportService.getHoldings(true, forceFetch).subscribe({
      next: (holdings) => {
        this.holdings = holdings;
        this.totalValue = holdings.reduce((sum, h) => sum + (h.market_value_base ?? h.cost_basis_base), 0);
        this.totalCost = holdings.reduce((sum, h) => sum + h.cost_basis_base, 0);
        this.totalUnrealized = holdings.reduce((sum, h) => sum + (h.unrealized_gain_base ?? 0), 0);
        this.buildCharts(holdings);
        this.applyFiltersAndSort();
        this.lastRefreshed = new Date();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load live holdings market data', err);
        this.isLoading = false;
      },
    });
  }

  refreshLivePrices() {
    if (!this.isLoading) {
      this.loadData(true);
    }
  }
  onSortChange(event: { key: string; direction: SortDirection }) {
    this.sortKey = event.direction ? event.key : null;
    this.sortDirection = event.direction;
    this.applyFiltersAndSort();
  }

  applyFiltersAndSort() {
    const filtered = this.selectedAssetType
      ? this.holdings.filter((holding) => holding.asset_type === this.selectedAssetType)
      : [...this.holdings];

    if (!this.sortKey || !this.sortDirection) {
      this.filteredHoldings = filtered;
      return;
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredHoldings = [...filtered].sort((a, b) => {
      const valueA = (a as Record<string, any>)[this.sortKey!];
      const valueB = (b as Record<string, any>)[this.sortKey!];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return -1 * direction;
      if (valueB == null) return 1 * direction;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      const stringA = String(valueA).toLowerCase();
      const stringB = String(valueB).toLowerCase();
      const compareResult = stringA < stringB ? -1 : stringA > stringB ? 1 : 0;
      return compareResult * direction;
    });
  }




  private buildCharts(holdings: Holding[]) {
    const byType = new Map<string, number>();
    for (const h of holdings) {
      const value = h.market_value_base ?? h.cost_basis_base;
      byType.set(h.asset_type, (byType.get(h.asset_type) ?? 0) + value);
    }

    const palette = ['#2B6E64', '#7C8592', '#B9C1BB', '#2E7D4F', '#DADFD9'];

    this.allocationChart = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = Array.isArray(params) ? params[0] : params;
          const percent = Number(data.percent ?? 0).toFixed(1);
          return `<strong>${data.name.toUpperCase()}</strong><br/>${percent}% of portfolio`;
        },
      },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '75%'],
          itemStyle: { borderColor: '#F5F6F4', borderWidth: 2 },
          label: { 
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            formatter: (params: any) => {
              const data = Array.isArray(params) ? params[0] : params;
              const percent = Number(data.percent ?? 0).toFixed(1);
              return `${data.name.toUpperCase()}(${percent}%)`;
            }
          },
          data: Array.from(byType.entries()).map(([name, value], i) => ({
            name,
            value: Math.round(value * 100) / 100,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };

    this.holdingChart = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = Array.isArray(params) ? params[0] : params;
          const percent = Number(data.percent ?? 0).toFixed(1);
          return `<strong>${data.name}</strong><br/>${percent}% of portfolio`;
        },
      },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '75%'],
          itemStyle: { borderColor: '#F5F6F4', borderWidth: 2 },
          label: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
          data: holdings.map((h, i) => ({
            name: h.ticker,
            value: Math.round((h.market_value_base ?? h.cost_basis_base) * 100) / 100,
            itemStyle: { color: palette[i % palette.length] },
          })),
          tooltip: {
            formatter: (params: any) => {
              const data = Array.isArray(params) ? params[0] : params;
              const h = holdings.find((h) => h.ticker === data.name);
              if (!h) return '';
              const value = h.market_value_base ?? h.cost_basis_base;
              const percent = Number(data.percent ?? 0).toFixed(1);
              return `<strong>${h.ticker} — ${h.name}</strong><br/>${percent}% of portfolio<br/>Value: €${value.toFixed(2)}`;
            },
          },
        },
      ],
    };
  }
}
