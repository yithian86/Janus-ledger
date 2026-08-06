import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Transaction, TransactionCreate, TransactionUpdate, TransactionType } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly api = inject(ApiService);

  private readonly transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  readonly transactions$: Observable<Transaction[]> = this.transactionsSubject.asObservable();

  refresh(filters?: { asset_id?: number; transaction_type?: TransactionType }): Observable<Transaction[]> {
    return this.api
      .get<Transaction[]>('/transactions', filters)
      .pipe(tap((txns) => this.transactionsSubject.next(txns)));
  }

  create(payload: TransactionCreate): Observable<Transaction> {
    return this.api.post<Transaction>('/transactions', payload).pipe(
      tap((txn) => this.transactionsSubject.next([txn, ...this.transactionsSubject.value]))
    );
  }

  update(id: number, payload: TransactionUpdate): Observable<Transaction> {
    return this.api.patch<Transaction>(`/transactions/${id}`, payload).pipe(
      tap((updated) =>
        this.transactionsSubject.next(
          this.transactionsSubject.value.map((t) => (t.id === id ? updated : t))
        )
      )
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/transactions/${id}`).pipe(
      tap(() =>
        this.transactionsSubject.next(this.transactionsSubject.value.filter((t) => t.id !== id))
      )
    );
  }
}
