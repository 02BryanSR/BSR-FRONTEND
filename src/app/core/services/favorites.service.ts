import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api.constants';
import { UserFavorite } from '../interfaces/shop.interface';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'bsr.favorites.productIds';

type JsonObject = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly favoritesState = signal<readonly number[]>([]);
  private readonly itemsState = signal<readonly UserFavorite[]>([]);

  private syncedEmail: string | null = null;

  readonly favorites = this.favoritesState.asReadonly();
  readonly items = this.itemsState.asReadonly();
  readonly count = computed(() => this.favoritesState().length);

  constructor() {
    effect(
      () => {
        const isAuthenticated = this.authService.isAuthenticated();
        const email = this.authService.currentUser()?.email ?? null;

        if (!isAuthenticated || !email) {
          this.syncedEmail = null;
          this.itemsState.set([]);
          this.setFavorites(this.restoreFavorites());
          return;
        }

        if (this.syncedEmail === email) {
          return;
        }

        this.syncedEmail = email;
        this.syncFavorites(this.restoreFavorites());
      },
      { allowSignalWrites: true },
    );
  }

  isFavorite(productId: number): boolean {
    return this.favoritesState().includes(productId);
  }

  toggle(productId: number): Observable<boolean> {
    if (!Number.isFinite(productId) || productId <= 0) {
      return of(false);
    }

    const currentFavorites = this.favoritesState();
    const shouldSave = !currentFavorites.includes(productId);
    const nextFavorites = shouldSave
      ? [...currentFavorites, productId]
      : currentFavorites.filter((id) => id !== productId);

    this.setFavorites(nextFavorites);

    if (!this.authService.isAuthenticated()) {
      return of(shouldSave);
    }

    const request$ = shouldSave
      ? this.http
          .post<unknown>(API_ENDPOINTS.shop.favorites, null, {
            params: new HttpParams().set('productId', productId),
          })
          .pipe(
            map((response) => this.mapFavorite(response)),
            tap((favorite) => {
              if (!favorite) {
                return;
              }

              this.itemsState.update((currentItems) => {
                const filteredItems = currentItems.filter((item) => item.productId !== favorite.productId);
                return [favorite, ...filteredItems];
              });
            }),
            map(() => true),
          )
      : this.http.delete<void>(API_ENDPOINTS.shop.favorite(productId)).pipe(
          tap(() => this.itemsState.update((currentItems) => currentItems.filter((item) => item.productId !== productId))),
          map(() => false),
        );

    return request$.pipe(
      tap(() => this.persistFavorites(this.favoritesState())),
      catchError((error) => {
        this.setFavorites(currentFavorites);
        return throwError(() => error);
      }),
    );
  }

  loadMyFavorites(): Observable<readonly UserFavorite[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.favorites).pipe(
      map((response) => this.mapFavorites(response)),
      tap((items) => {
        this.itemsState.set(items);
        this.setFavorites(items.map((item) => item.productId));
      }),
    );
  }

  remove(productId: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.shop.favorite(productId)).pipe(
      tap(() => {
        this.itemsState.update((currentItems) => currentItems.filter((item) => item.productId !== productId));
        this.setFavorites(this.favoritesState().filter((id) => id !== productId));
      }),
    );
  }

  private syncFavorites(localFavorites: readonly number[]): void {
    this.loadRemoteFavorites()
      .pipe(
        switchMap((remoteFavorites) => {
          const missingFavorites = localFavorites.filter((productId) => !remoteFavorites.includes(productId));

          if (!missingFavorites.length) {
            return of(remoteFavorites);
          }

          return forkJoin(
            missingFavorites.map((productId) =>
              this.http
                .post(API_ENDPOINTS.shop.favorites, null, {
                  params: new HttpParams().set('productId', productId),
                })
                .pipe(catchError(() => of(null))),
            ),
          ).pipe(switchMap(() => this.loadRemoteFavorites()));
        }),
        catchError(() => of(localFavorites)),
      )
      .subscribe((favoriteIds) => this.setFavorites(favoriteIds));
  }

  private loadRemoteFavorites(): Observable<readonly number[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.favorites).pipe(
      map((response) => this.mapFavoriteIds(response)),
    );
  }

  private mapFavorites(input: unknown): readonly UserFavorite[] {
    return this.asArray(input)
      .map((item) => this.mapFavorite(item))
      .filter((item): item is UserFavorite => !!item);
  }

  private mapFavorite(input: unknown): UserFavorite | null {
    const source = this.asObject(input);
    const productId = this.toNumber(this.pick(source, ['productId']));

    if (productId === null) {
      return null;
    }

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      customerId: this.toNumber(this.pick(source, ['customerId'])),
      productId,
      productName: this.toStringValue(this.pick(source, ['productName'])) || `Producto #${productId}`,
      productSku: this.toStringValue(this.pick(source, ['productSku'])),
      productImageUrl: this.resolveAssetUrl(
        this.toStringValue(this.pick(source, ['productImageUrl', 'imageUrl', 'image'])),
      ),
      productPrice: this.toNumber(this.pick(source, ['productPrice', 'price'])),
      productStock: this.toNumber(this.pick(source, ['productStock', 'stock'])),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
    };
  }

  private mapFavoriteIds(input: unknown): readonly number[] {
    return this.asArray(input).flatMap((item) => {
      const productId = this.toNumber(this.pick(this.asObject(item), ['productId']));
      return productId === null ? [] : [productId];
    });
  }

  private restoreFavorites(): readonly number[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);

      if (!rawValue) {
        return [];
      }

      const parsed = JSON.parse(rawValue);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? [numericValue] : [];
      });
    } catch {
      return [];
    }
  }

  private setFavorites(productIds: readonly number[]): void {
    const uniqueIds = [...new Set(productIds.filter((productId) => Number.isFinite(productId)))];
    this.favoritesState.set(uniqueIds);
    this.persistFavorites(uniqueIds);
  }

  private resolveAssetUrl(assetPath: string | null): string | null {
    const normalizedPath = assetPath?.trim();

    if (!normalizedPath) {
      return null;
    }

    if (
      normalizedPath.startsWith('http://') ||
      normalizedPath.startsWith('https://') ||
      normalizedPath.startsWith('data:') ||
      normalizedPath.startsWith('blob:')
    ) {
      return normalizedPath;
    }

    if (normalizedPath.startsWith('/')) {
      return `${API_BASE_URL}${normalizedPath}`;
    }

    return `${API_BASE_URL}/${normalizedPath.replace(/^\/+/, '')}`;
  }

  private persistFavorites(productIds: readonly number[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(productIds));
    } catch {}
  }

  private asArray(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === 'object' ? (value as JsonObject) : {};
  }

  private pick(source: JsonObject, keys: readonly string[]): unknown {
    for (const key of keys) {
      const value = source[key];

      if (value !== undefined && value !== null) {
        return value;
      }
    }

    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const normalizedValue = Number(value);
      return Number.isFinite(normalizedValue) ? normalizedValue : null;
    }

    return null;
  }

  private toStringValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();
      return normalizedValue ? normalizedValue : null;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }
}
