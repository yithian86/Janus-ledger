import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PriceSnapshot, PriceSnapshotCreate, FxRate, FxRateCreate } from '../models/price.model';

@Injectable({ providedIn: 'root' })
export class PriceService {
  private readonly api = inject(ApiService);

  listPrices(assetId?: number): Observable<PriceSnapshot[]> {
    return this.api.get<PriceSnapshot[]>('/prices', { asset_id: assetId });
  }

  addPrice(payload: PriceSnapshotCreate): Observable<PriceSnapshot> {
    return this.api.post<PriceSnapshot>('/prices', payload);
  }

  deletePrice(id: number): Observable<void> {
    return this.api.delete<void>(`/prices/${id}`);
  }

  listFxRates(currency?: string): Observable<FxRate[]> {
    return this.api.get<FxRate[]>('/fx-rates', { currency });
  }

  addFxRate(payload: FxRateCreate): Observable<FxRate> {
    return this.api.post<FxRate>('/fx-rates', payload);
  }

  deleteFxRate(id: number): Observable<void> {
    return this.api.delete<void>(`/fx-rates/${id}`);
  }
}
