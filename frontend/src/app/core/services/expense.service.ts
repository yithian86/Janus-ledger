import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Expense, ExpenseCreate, ExpenseUpdate } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly api = inject(ApiService);
  private readonly expensesSubject = new BehaviorSubject<Expense[]>([]);
  readonly expenses$ = this.expensesSubject.asObservable();

  refresh(): Observable<Expense[]> {
    return this.api.get<Expense[]>('/expenses').pipe(tap((expenses) => this.expensesSubject.next(expenses)));
  }

  create(payload: ExpenseCreate): Observable<Expense> {
    return this.api.post<Expense>('/expenses', payload).pipe(
      tap((expense) => this.expensesSubject.next([expense, ...this.expensesSubject.value]))
    );
  }

  createBatch(payload: {
    start_date: string;
    end_date: string;
    amount: number;
    currency: string;
    category: string;
    subcategory?: string;
    description?: string;
  }): Observable<Expense[]> {
    return this.api.post<Expense[]>('/expenses/batch', payload).pipe(
      tap((expenses) => this.expensesSubject.next([...expenses, ...this.expensesSubject.value]))
    );
  }

  update(id: number, payload: ExpenseUpdate): Observable<Expense> {
    return this.api.patch<Expense>(`/expenses/${id}`, payload).pipe(
      tap((updated) =>
        this.expensesSubject.next(this.expensesSubject.value.map((expense) => expense.id === id ? updated : expense))
      )
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/expenses/${id}`).pipe(
      tap(() => this.expensesSubject.next(this.expensesSubject.value.filter((expense) => expense.id !== id)))
    );
  }
}
