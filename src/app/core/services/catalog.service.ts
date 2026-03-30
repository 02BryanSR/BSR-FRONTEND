import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api.constants';
import { PRIMARY_NAV_LINKS, type NavigationLink } from '../constants/navigation.constants';
import {
  type CatalogCategory,
  type CatalogProduct,
  type CatalogSearchItem,
  type CategoryApiResponse,
  type CategorySlug,
  type ProductApiResponse,
} from '../interfaces/catalog.interface';

const CATEGORY_ALIASES: Record<CategorySlug, readonly string[]> = {
  women: ['women', 'woman', 'mujer', 'mujeres', 'ladies', 'lady'],
  men: ['men', 'man', 'hombre', 'hombres'],
  boys: ['boys', 'boy', 'nino', 'ninos'],
  girls: ['girls', 'girl', 'nina', 'ninas'],
  kids: ['kids', 'kid', 'children', 'child', 'infantil'],
  accessories: ['accessories', 'accessory', 'accesorio', 'accesorios', 'complemento', 'complementos'],
};

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly http = inject(HttpClient);

  private readonly categoriesRequest$ = this.http
    .get<CategoryApiResponse[]>(API_ENDPOINTS.catalog.categories)
    .pipe(
      map((categories) => categories.map((category) => this.mapCategory(category))),
      catchError(() => of([] as CatalogCategory[])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  private readonly searchEntriesRequest$ = this.categoriesRequest$.pipe(
    switchMap((categories) => {
      if (!categories.length) {
        return of([] as CatalogSearchItem[]);
      }

      return forkJoin(
        categories.map((category) =>
          this.getProductsByCategoryId(category.id).pipe(map((products) => ({ category, products }))),
        ),
      ).pipe(
        map((groups) => this.buildSearchEntries(groups)),
        catchError(() => of(this.buildCategorySearchEntries(categories))),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getCategories(): Observable<readonly CatalogCategory[]> {
    return this.categoriesRequest$;
  }

  getCategoryBySlug(slug: CategorySlug): Observable<CatalogCategory | null> {
    return this.categoriesRequest$.pipe(
      map((categories) => categories.find((category) => category.slug === slug) ?? null),
    );
  }

  getProductsByCategoryId(categoryId: number): Observable<readonly CatalogProduct[]> {
    return this.http.get<ProductApiResponse[]>(API_ENDPOINTS.catalog.productsByCategory(categoryId)).pipe(
      map((products) => products.map((product) => this.mapProduct(product))),
      catchError(() => of([] as CatalogProduct[])),
    );
  }

  getProductById(productId: number): Observable<CatalogProduct | null> {
    return this.http.get<ProductApiResponse>(API_ENDPOINTS.catalog.product(productId)).pipe(
      map((product) => this.mapProduct(product)),
      catchError(() => of(null)),
    );
  }

  getProductsByIds(productIds: readonly number[]): Observable<readonly CatalogProduct[]> {
    const uniqueProductIds = [...new Set(productIds.filter((productId) => Number.isFinite(productId)))];

    if (!uniqueProductIds.length) {
      return of([]);
    }

    return forkJoin(uniqueProductIds.map((productId) => this.getProductById(productId))).pipe(
      map((products) => products.filter((product): product is CatalogProduct => !!product)),
    );
  }

  getSearchEntries(): Observable<readonly CatalogSearchItem[]> {
    return this.searchEntriesRequest$;
  }

  getNavigationLinks(): Observable<readonly NavigationLink[]> {
    return this.categoriesRequest$.pipe(
      map((categories) => {
        const dynamicLinks = categories
          .filter((category) => !!category.route)
          .map((category) => ({
            label: category.name.trim().toUpperCase(),
            route: category.route!,
            categorySlug: category.slug,
          }));

        if (!dynamicLinks.length) {
          return PRIMARY_NAV_LINKS;
        }

        return [PRIMARY_NAV_LINKS[0], ...dynamicLinks];
      }),
      catchError(() => of(PRIMARY_NAV_LINKS)),
    );
  }

  private mapCategory(category: CategoryApiResponse): CatalogCategory {
    const slug = this.resolveCategorySlug(category.name);
    const normalizedName = this.normalizeCategoryName(category.name, slug);
    const route = this.resolveCategoryRoute(slug);

    return {
      id: category.id,
      name: normalizedName || 'Categoría',
      description: category.description?.trim() || '',
      imageUrl: this.resolveBackendAssetUrl(category.imageUrl ?? null),
      productIds: category.productIds ?? [],
      slug,
      route,
    };
  }

  private mapProduct(product: ProductApiResponse): CatalogProduct {
    return {
      id: product.id,
      name: product.name?.trim() || 'Producto',
      sku: product.sku?.trim() || null,
      description: product.description?.trim() || '',
      price: typeof product.price === 'number' ? product.price : null,
      stock: typeof product.stock === 'number' ? product.stock : null,
      categoryId: product.categoryId,
      imageUrl: this.resolveBackendAssetUrl(
        product.imageUrl ?? product.image ?? product.imagePath ?? product.thumbnailUrl ?? null,
      ),
    };
  }

  private buildSearchEntries(
    groups: readonly { category: CatalogCategory; products: readonly CatalogProduct[] }[],
  ): CatalogSearchItem[] {
    const categoryEntries = this.buildCategorySearchEntries(groups.map(({ category }) => category));
    const seenProducts = new Set<number>();
    const productEntries: CatalogSearchItem[] = [];

    groups.forEach(({ category, products }) => {
      products.forEach((product) => {
        if (seenProducts.has(product.id)) {
          return;
        }

        seenProducts.add(product.id);
        productEntries.push(this.createProductSearchEntry(product, category));
      });
    });

    return [...categoryEntries, ...productEntries];
  }

  private buildCategorySearchEntries(categories: readonly CatalogCategory[]): CatalogSearchItem[] {
    return categories
      .filter((category) => !!category.route)
      .map((category) => this.createCategorySearchEntry(category));
  }

  private createCategorySearchEntry(category: CatalogCategory): CatalogSearchItem {
    return {
      type: 'category',
      id: category.id,
      title: category.name,
      subtitle: category.description || 'Explorar categoría',
      route: category.route ?? '/home',
      imageUrl: category.imageUrl,
      keywords: this.buildKeywords(
        category.name,
        category.description,
        category.slug,
        category.route,
        ...(category.slug ? CATEGORY_ALIASES[category.slug] : []),
      ),
    };
  }

  private createProductSearchEntry(
    product: CatalogProduct,
    category: CatalogCategory | null | undefined,
  ): CatalogSearchItem {
    return {
      type: 'product',
      id: product.id,
      title: product.name,
      subtitle: category?.name ?? product.sku ?? 'Producto',
      route: `/products/${product.id}`,
      imageUrl: product.imageUrl,
      keywords: this.buildKeywords(
        product.name,
        product.description,
        product.sku,
        category?.name,
        category?.slug,
        ...(category?.slug ? CATEGORY_ALIASES[category.slug] : []),
      ),
    };
  }

  private buildKeywords(...values: (string | null | undefined)[]): readonly string[] {
    const keywords = new Set<string>();

    values.forEach((value) => {
      const normalizedValue = this.normalizeText(value);

      if (!normalizedValue) {
        return;
      }

      keywords.add(normalizedValue);

      normalizedValue
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .forEach((token) => keywords.add(token));
    });

    return [...keywords];
  }

  private resolveCategorySlug(categoryName: string | null | undefined): CategorySlug | null {
    const normalizedName = this.normalizeText(categoryName);

    if (!normalizedName) {
      return null;
    }

    for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES) as [
      CategorySlug,
      readonly string[],
    ][]) {
      if (aliases.some((alias) => normalizedName === alias || normalizedName.includes(alias))) {
        return slug;
      }
    }

    return null;
  }

  private normalizeText(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeCategoryName(
    value: string | null | undefined,
    slug: CategorySlug | null,
  ): string {
    const normalizedValue = value?.trim() || '';

    if (slug === 'boys') {
      return 'Ni\u00F1os';
    }

    if (slug === 'girls') {
      return 'Ni\u00F1as';
    }

    if (slug === 'accessories') {
      return 'Accesorios';
    }

    return normalizedValue;
  }

  private resolveCategoryRoute(slug: CategorySlug | null): string | null {
    switch (slug) {
      case 'women':
        return '/women';
      case 'men':
        return '/men';
      case 'boys':
        return '/ninos';
      case 'girls':
        return '/ninas';
      case 'kids':
        return '/kids';
      case 'accessories':
        return '/accessories';
      default:
        return null;
    }
  }

  private resolveBackendAssetUrl(assetPath: string | null): string | null {
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
}
