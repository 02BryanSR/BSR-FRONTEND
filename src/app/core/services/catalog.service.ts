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
  accessories: ['accessories', 'accessory', 'accesorio', 'accesorios', 'complemento', 'complementos'],
};

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  women: 'Mujer',
  men: 'Hombre',
  boys: 'Niños',
  girls: 'Niñas',
  accessories: 'Accesorios',
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

  getCategoryBySlug(slug: CategorySlug): Observable<CatalogCategory> {
    return this.categoriesRequest$.pipe(map((categories) => categories.find((category) => category.slug === slug)!));
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
        const dynamicLinks = categories.map((category) => ({
          label: category.name.trim().toUpperCase(),
          route: category.route,
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

    return {
      id: category.id,
      name: this.normalizeCategoryName(slug),
      description: category.description.trim(),
      imageUrl: this.resolveBackendAssetUrl(category.imageUrl),
      productIds: category.productIds,
      slug,
      route: this.resolveCategoryRoute(slug),
    };
  }

  private mapProduct(product: ProductApiResponse): CatalogProduct {
    return {
      id: product.id,
      name: product.name.trim(),
      sku: product.sku.trim(),
      description: product.description.trim(),
      price: product.price,
      stock: product.stock,
      categoryId: product.categoryId,
      imageUrl: this.resolveBackendAssetUrl(
        product.imageUrl ?? product.image ?? product.imagePath ?? product.thumbnailUrl,
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
    return categories.map((category) => this.createCategorySearchEntry(category));
  }

  private createCategorySearchEntry(category: CatalogCategory): CatalogSearchItem {
    return {
      type: 'category',
      id: category.id,
      title: category.name,
      subtitle: category.description || 'Explorar categor\u00EDa',
      route: category.route,
      imageUrl: category.imageUrl,
      keywords: this.buildKeywords(
        category.name,
        category.description,
        category.slug,
        category.route,
        ...CATEGORY_ALIASES[category.slug],
      ),
    };
  }

  private createProductSearchEntry(product: CatalogProduct, category: CatalogCategory): CatalogSearchItem {
    return {
      type: 'product',
      id: product.id,
      title: product.name,
      subtitle: category.name,
      route: `/products/${product.id}`,
      imageUrl: product.imageUrl,
      keywords: this.buildKeywords(
        product.name,
        product.description,
        product.sku,
        category.name,
        category.slug,
        ...CATEGORY_ALIASES[category.slug],
      ),
    };
  }

  private buildKeywords(...values: readonly string[]): readonly string[] {
    const keywords = new Set<string>();

    values.map((value) => this.normalizeText(value)).filter(Boolean).forEach((normalizedValue) => {
      keywords.add(normalizedValue);

      normalizedValue
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .forEach((token) => keywords.add(token));
    });

    return [...keywords];
  }

  private resolveCategorySlug(categoryName: string): CategorySlug {
    const normalizedName = this.normalizeText(categoryName);
    return (Object.entries(CATEGORY_ALIASES) as [CategorySlug, readonly string[]][])
      .find(([, aliases]) => aliases.some((alias) => normalizedName === alias || normalizedName.includes(alias)))![0];
  }

  private normalizeText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeCategoryName(slug: CategorySlug): string {
    return CATEGORY_LABELS[slug];
  }

  private resolveCategoryRoute(slug: CategorySlug): string {
    return `/${slug}`;
  }

  private resolveBackendAssetUrl(assetPath: string | null | undefined): string | null {
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
