import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ReportService } from '../../core/services/report.service';
import { Holding } from '../../core/models/report.model';
import { TableComponent, TableColumn } from '../../commons/components/table/table.component';

@Component({
  selector: 'pt-dashboard',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, TableComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  holdings: Holding[] = [];
  totalValue = 0;
  totalCost = 0;
  totalUnrealized = 0;
  isLoading = false;
  lastRefreshed?: Date;

  allocationChart?: EChartsOption;
  holdingChart?: EChartsOption;

  columns: TableColumn<Holding>[] = [
    { key: 'ticker', header: 'Ticker' },
    { key: 'name', header: 'Name' },
    { key: 'asset_type', header: 'Type' },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'avg_cost', header: 'Avg cost', numeric: true },
    { key: 'current_price', header: 'Price', numeric: true },
    { key: 'market_value_base', header: 'Value (€)', numeric: true },
    { key: 'unrealized_gain_base', header: 'Unrealized gain', numeric: true },
  ];

  ngOnInit() {
    this.loadData();
  }


  loadData() {
    this.isLoading = true;
    this.reportService.getHoldings(true).subscribe({
      next: (holdings) => {
        this.holdings = holdings;
        this.totalValue = holdings.reduce((sum, h) => sum + (h.market_value_base ?? h.cost_basis_base), 0);
        this.totalCost = holdings.reduce((sum, h) => sum + h.cost_basis_base, 0);
        this.totalUnrealized = holdings.reduce((sum, h) => sum + (h.unrealized_gain_base ?? 0), 0);
        this.buildCharts(holdings);
        this.lastRefreshed = new Date();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load live holdings market data', err);
        this.isLoading = false;
      },
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
