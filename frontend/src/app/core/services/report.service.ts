import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Holding, RealizedGain, CashFlowPeriod, IncomeByPeriod, Granularity } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);

  getHoldings(): Observable<Holding[]> {
    return this.api.get<Holding[]>('/reports/holdings');
  }

  getRealizedGains(year?: number): Observable<RealizedGain[]> {
    return this.api.get<RealizedGain[]>('/reports/realized-gains', { year });
  }

  getCashFlow(granularity: Granularity = 'month'): Observable<CashFlowPeriod[]> {
    return this.api.get<CashFlowPeriod[]>('/reports/cash-flow', { granularity });
  }

  getIncomeByPeriod(granularity: Granularity = 'month'): Observable<IncomeByPeriod[]> {
    return this.api.get<IncomeByPeriod[]>('/reports/income', { granularity });
  }
}
