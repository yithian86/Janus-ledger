import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ReportService } from '../../core/services/report.service';
import { CashFlowPeriod, IncomeByPeriod, RealizedGain, Granularity } from '../../core/models/report.model';
import { TableComponent, TableColumn } from '../../commons/components/table/table.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';
import { AssetService } from '../../core/services/asset.service';


type Tab = 'cash-flow' | 'income' | 'realized-gains';

const GRANULARITY_OPTIONS: SelectOption[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

@Component({
  selector: 'pt-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, TableComponent, SelectComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly assetsService = inject(AssetService);

  activeTab: Tab = 'cash-flow';
  granularity: Granularity = 'month';
  granularityOptions = GRANULARITY_OPTIONS;

  cashFlow: CashFlowPeriod[] = [];
  income: IncomeByPeriod[] = [];
  realizedGains: RealizedGain[] = [];
  realizedTotals = {
    proceeds_base: 0,
    cost_basis_base: 0,
    fees_base: 0,
    realized_gain_base: 0,
  } as Record<string, number>;
  cashFlowChart?: EChartsOption;

  cashFlowColumns: TableColumn<CashFlowPeriod>[] = [
    { key: 'period', header: 'Period' },
    { key: 'invested_base', header: 'Invested', numeric: true },
    { key: 'divested_base', header: 'Divested', numeric: true },
    { key: 'income_base', header: 'Income', numeric: true },
    { key: 'fees_base', header: 'Fees', numeric: true },
    { key: 'deposits_base', header: 'Deposits', numeric: true },
    { key: 'withdrawals_base', header: 'Withdrawals', numeric: true },
    { key: 'net_flow_base', header: 'Net flow', numeric: true },
  ];

  incomeColumns: TableColumn<IncomeByPeriod>[] = [
    { key: 'period', header: 'Period' },
    { key: 'ticker', header: 'Asset ID' },
    { key: 'asset_name', header: 'Asset Name' },
    { key: 'income_base', header: 'Income (€)', numeric: true },
  ];

  realizedGainColumns: TableColumn<RealizedGain>[] = [
    { key: 'year', header: 'Year' },
    { key: 'ticker', header: 'Asset ID' },
    { key: 'asset_name', header: 'Asset Name' },
    { key: 'proceeds_base', header: 'Proceeds', numeric: true },
    { key: 'cost_basis_base', header: 'Cost basis', numeric: true },
    { key: 'fees_base', header: 'Fees', numeric: true },
    { key: 'realized_gain_base', header: 'Realized gain', numeric: true },
  ];

  ngOnInit() {
    this.load();
  }

  get assetsMap () {
    return this.assetsService.assetMap;
  }

  public getAsset = (assetId: string) => {
    return this.assetsService.assetMap.get(assetId)?.name;
  }

  onGranularityChange() {
    this.load();
  }

  private load() {
    this.reportService.getCashFlow(this.granularity).subscribe((data) => {
      this.cashFlow = this.roundValues(data, [
        'invested_base',
        'divested_base',
        'income_base',
        'fees_base',
        'deposits_base',
        'withdrawals_base',
        'net_flow_base',
      ]);
      this.buildCashFlowChart(this.cashFlow);
    });
    this.reportService.getIncomeByPeriod(this.granularity).subscribe((data) => {
      this.income = this.roundValues(data, ['income_base']);
    });
    this.reportService.getRealizedGains().subscribe((data) => {
      this.realizedGains = this.roundValues(data, ['proceeds_base', 'cost_basis_base', 'fees_base', 'realized_gain_base']);
      this.computeRealizedTotals(this.realizedGains);
    });
  }

  private computeRealizedTotals(data: RealizedGain[]) {
    const totals = data.reduce(
      (acc, cur) => {
        acc['proceeds_base'] += typeof cur.proceeds_base === 'number' ? cur.proceeds_base : 0;
        acc['cost_basis_base'] += typeof cur.cost_basis_base === 'number' ? cur.cost_basis_base : 0;
        acc['fees_base'] += typeof cur.fees_base === 'number' ? cur.fees_base : 0;
        acc['realized_gain_base'] += typeof cur.realized_gain_base === 'number' ? cur.realized_gain_base : 0;
        return acc;
      },
      { proceeds_base: 0, cost_basis_base: 0, fees_base: 0, realized_gain_base: 0 } as Record<string, number>
    );

    // Round to 2 decimals
    Object.keys(totals).forEach((k) => {
      totals[k] = Number(totals[k].toFixed(2));
    });

    this.realizedTotals = totals;
  }

  private roundValues<T extends object>(data: T[], keys: Array<keyof T>): T[] {
    return data.map((item) => {
      const roundedItem = { ...item } as T;
      keys.forEach((key) => {
        const value = roundedItem[key as keyof T];
        if (typeof value === 'number') {
          (roundedItem as Record<keyof T, unknown>)[key] = Number(value.toFixed(2));
        }
      });
      return roundedItem;
    });
  }

  private buildCashFlowChart(data: CashFlowPeriod[]) {
    this.cashFlowChart = {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { fontFamily: 'Inter, sans-serif' } },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      xAxis: { type: 'category', data: data.map((d) => d.period) },
      yAxis: { type: 'value', axisLabel: { fontFamily: 'IBM Plex Mono, monospace' } },
      series: [
        { name: 'Invested', type: 'bar', stack: 'flow', data: data.map((d) => Number((-d.invested_base).toFixed(2))), itemStyle: { color: '#2B6E64' } },
        { name: 'Income', type: 'bar', stack: 'flow', data: data.map((d) => Number(d.income_base.toFixed(2))), itemStyle: { color: '#2E7D4F' } },
        { name: 'Withdrawals', type: 'bar', stack: 'flow', data: data.map((d) => Number((-d.withdrawals_base).toFixed(2))), itemStyle: { color: '#B23B3B' } },
        { name: 'Net flow', type: 'line', data: data.map((d) => Number(d.net_flow_base.toFixed(2))), itemStyle: { color: '#1C232C' } },
      ],
    };
  }
}
