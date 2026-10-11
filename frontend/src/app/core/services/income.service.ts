import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Income, IncomeCreate, IncomeUpdate } from '../models/income.model';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly api = inject(ApiService);
  private readonly incomesSubject = new BehaviorSubject<Income[]>([]);
  readonly incomes$ = this.incomesSubject.asObservable();

  refresh(): Observable<Income[]> {
    return this.api.get<Income[]>('/incomes').pipe(tap((incomes) => this.incomesSubject.next(incomes)));
  }

  create(payload: IncomeCreate): Observable<Income> {
    return this.api.post<Income>('/incomes', payload).pipe(
      tap((income) => this.incomesSubject.next([income, ...this.incomesSubject.value]))
    );
  }

  createBatch(payload: {
    start_date: string;
    end_date: string;
    amount: number;
    currency: string;
    source: string;
    description?: string;
  }): Observable<Income[]> {
    return this.api.post<Income[]>('/incomes/batch', payload).pipe(
      tap((incomes) => this.incomesSubject.next([...incomes, ...this.incomesSubject.value]))
    );
  }

  update(id: number, payload: IncomeUpdate): Observable<Income> {
    return this.api.patch<Income>(`/incomes/${id}`, payload).pipe(
      tap((updated) =>
        this.incomesSubject.next(this.incomesSubject.value.map((income) => income.id === id ? updated : income))
      )
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/incomes/${id}`).pipe(
      tap(() => this.incomesSubject.next(this.incomesSubject.value.filter((income) => income.id !== id)))
    );
  }
}
