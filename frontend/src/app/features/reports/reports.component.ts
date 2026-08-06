import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ReportService } from '../../core/services/report.service';
import { CashFlowPeriod, IncomeByPeriod, RealizedGain, Granularity } from '../../core/models/report.model';
import { TableComponent, TableColumn } from '../../commons/components/table/table.component';
import { SelectComponent, SelectOption } from '../../commons/components/select/select.component';


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

  activeTab: Tab = 'cash-flow';
  granularity: Granularity = 'month';
  granularityOptions = GRANULARITY_OPTIONS;

  cashFlow: CashFlowPeriod[] = [];
  income: IncomeByPeriod[] = [];
  realizedGains: RealizedGain[] = [];
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
    { key: 'ticker', header: 'Asset' },
    { key: 'income_base', header: 'Income (€)', numeric: true },
  ];

  realizedGainColumns: TableColumn<RealizedGain>[] = [
    { key: 'year', header: 'Year' },
    { key: 'ticker', header: 'Asset' },
    { key: 'proceeds_base', header: 'Proceeds', numeric: true },
    { key: 'cost_basis_base', header: 'Cost basis', numeric: true },
    { key: 'fees_base', header: 'Fees', numeric: true },
    { key: 'realized_gain_base', header: 'Realized gain', numeric: true },
  ];

  ngOnInit() {
    this.load();
  }

  onGranularityChange() {
    this.load();
  }

  private load() {
    this.reportService.getCashFlow(this.granularity).subscribe((data) => {
      this.cashFlow = data;
      this.buildCashFlowChart(data);
    });
    this.reportService.getIncomeByPeriod(this.granularity).subscribe((data) => (this.income = data));
    this.reportService.getRealizedGains().subscribe((data) => (this.realizedGains = data));
  }

  private buildCashFlowChart(data: CashFlowPeriod[]) {
    this.cashFlowChart = {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { fontFamily: 'Inter, sans-serif' } },
      textStyle: { fontFamily: 'Inter, sans-serif' },
      xAxis: { type: 'category', data: data.map((d) => d.period) },
      yAxis: { type: 'value', axisLabel: { fontFamily: 'IBM Plex Mono, monospace' } },
      series: [
        { name: 'Invested', type: 'bar', stack: 'flow', data: data.map((d) => -d.invested_base), itemStyle: { color: '#2B6E64' } },
        { name: 'Income', type: 'bar', stack: 'flow', data: data.map((d) => d.income_base), itemStyle: { color: '#2E7D4F' } },
        { name: 'Withdrawals', type: 'bar', stack: 'flow', data: data.map((d) => -d.withdrawals_base), itemStyle: { color: '#B23B3B' } },
        { name: 'Net flow', type: 'line', data: data.map((d) => d.net_flow_base), itemStyle: { color: '#1C232C' } },
      ],
    };
  }
}
