import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Asset, AssetCreate, AssetUpdate } from '../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly api = inject(ApiService);

  private readonly assetsSubject = new BehaviorSubject<Asset[]>([]);
  /** Live list of assets, kept in sync after any create/update/delete. */
  readonly assets$: Observable<Asset[]> = this.assetsSubject.asObservable();

  refresh(includeArchived = false): Observable<Asset[]> {
    return this.api
      .get<Asset[]>('/assets', { include_archived: includeArchived })
      .pipe(tap((assets) => this.assetsSubject.next(assets)));
  }

  create(payload: AssetCreate): Observable<Asset> {
    return this.api.post<Asset>('/assets', payload).pipe(
      tap((asset) => this.assetsSubject.next([...this.assetsSubject.value, asset]))
    );
  }

  update(id: number, payload: AssetUpdate): Observable<Asset> {
    return this.api.patch<Asset>(`/assets/${id}`, payload).pipe(
      tap((updated) =>
        this.assetsSubject.next(
          this.assetsSubject.value.map((a) => (a.id === id ? updated : a))
        )
      )
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/assets/${id}`).pipe(
      tap(() =>
        this.assetsSubject.next(this.assetsSubject.value.filter((a) => a.id !== id))
      )
    );
  }
}
