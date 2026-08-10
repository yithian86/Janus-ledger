import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Asset, AssetCreate, AssetUpdate } from '../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly api = inject(ApiService);

  private readonly assetsSubject = new BehaviorSubject<Asset[]>([]);
  private readonly assetMapSubject = new BehaviorSubject<Map<string, Asset>>(new Map());

  /** Live list of assets, kept in sync after any create/update/delete. */
  readonly assets$: Observable<Asset[]> = this.assetsSubject.asObservable();
  /** Live asset cache keyed by ticker. */
  readonly assetMap$: Observable<Map<string, Asset>> = this.assetMapSubject.asObservable();

  public get assets(): Asset[] {
    return this.assetsSubject.value;
  }

  public get assetMap(): Map<string, Asset> {
    return this.assetMapSubject.value;
  }

  private setAssets(assets: Asset[]) {
    this.assetsSubject.next(assets);
    this.syncAssetMap(assets);
  }

  private syncAssetMap(assets: Asset[]) {
    const map = new Map<string, Asset>();
    assets.forEach((asset) => map.set(asset.ticker, asset));
    this.assetMapSubject.next(map);
  }

  refresh(includeArchived = false): Observable<Asset[]> {
    return this.api
      .get<Asset[]>('/assets', { include_archived: includeArchived })
      .pipe(tap((assets) => this.setAssets(assets)));
  }

  create(payload: AssetCreate): Observable<Asset> {
    return this.api.post<Asset>('/assets', payload).pipe(
      tap((asset) => this.setAssets([...this.assetsSubject.value, asset]))
    );
  }

  update(id: number, payload: AssetUpdate): Observable<Asset> {
    return this.api.patch<Asset>(`/assets/${id}`, payload).pipe(
      tap((updated) =>
        this.setAssets(
          this.assetsSubject.value.map((a) => (a.id === id ? updated : a))
        )
      )
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/assets/${id}`).pipe(
      tap(() => this.setAssets(this.assetsSubject.value.filter((a) => a.id !== id)))
    );
  }
}
