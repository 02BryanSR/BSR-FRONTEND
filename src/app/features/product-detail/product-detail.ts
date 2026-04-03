import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CatalogCategory, CatalogProduct } from '../../core/interfaces/catalog.interface';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';
import { resolveAvailableProductSizes } from '../../core/constants/product-size.constants';
import { CatalogProductCardComponent } from '../../shared/components/catalog-product-card/catalog-product-card';
import { SurfaceCardComponent } from '../../shared/components/surface-card/surface-card';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, CatalogProductCardComponent, SurfaceCardComponent],
  templateUrl: './product-detail.html',
})
export class ProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly categories = toSignal(this.catalogService.getCategories(), {
    initialValue: [] as readonly CatalogCategory[],
  });
  readonly product = signal<CatalogProduct | null>(null);
  readonly relatedProducts = signal<readonly CatalogProduct[]>([]);
  readonly loading = signal(true);
  readonly adding = signal(false);
  readonly selectedSize = signal<string | null>(null);
  readonly productCategory = computed(() => {
    const product = this.product();

    if (!product) {
      return null;
    }

    return this.categories().find((category) => category.id === product.categoryId) ?? null;
  });
  readonly availableSizes = computed(() => {
    return resolveAvailableProductSizes(this.product(), this.categories());
  });
  readonly isStoreAvailable = computed(() => (this.product()?.stock ?? 0) > 0);
  readonly requiresSizeSelection = computed(() => this.availableSizes().length > 0);
  readonly isFavorite = computed(() => {
    const product = this.product();
    return product ? this.favoritesService.isFavorite(product.id) : false;
  });
  readonly productReference = computed(() => {
    const product = this.product();

    if (!product) {
      return '';
    }

    return (
      product.sku?.trim() ||
      `${String(product.categoryId).padStart(3, '0')}/${String(product.id).padStart(4, '0')}`
    );
  });
  readonly productNarrative = computed(() => {
    const product = this.product();

    if (!product) {
      return '';
    }

    if (product.description.trim()) {
      return product.description.trim();
    }

    return `${product.name} forma parte del catálogo real conectado a tu backend y está listo para comprarse desde carrito y checkout.`;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const productId = Number(params.get('id'));

      if (!Number.isFinite(productId) || productId <= 0) {
        void this.router.navigate(['/home']);
        return;
      }

      this.loadProduct(productId);
    });
  }

  addToCart(product: CatalogProduct | null = this.product()): void {
    if (!product) {
      return;
    }

    const isCurrentProduct = this.product()?.id === product.id;
    const selectedSize = isCurrentProduct ? this.selectedSize() : null;

    if (isCurrentProduct && this.requiresSizeSelection() && !selectedSize) {
      this.toastService.show({
        title: 'Selecciona una talla',
        message: 'Elige tu talla antes de añadir el producto al carrito.',
      });
      return;
    }

    if ((product.stock ?? 0) <= 0) {
      this.toastService.showError('Producto agotado. Ya no se puede añadir al carrito.');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.toastService.show({
        title: 'Necesitas iniciar sesión',
        message: 'Inicia sesión para añadir productos al carrito.',
      });
      void this.router.navigate(['/login']);
      return;
    }

    this.adding.set(true);

    this.shopService
      .addItem(product.id, 1, selectedSize)
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Producto añadido',
            message: `${product.name}${selectedSize ? ` en talla ${selectedSize}` : ''} ya está en tu carrito.`,
          });
        },
        error: (error) => {
          this.toastService.showError(
            error.error?.message ?? 'No se pudo añadir el producto al carrito.',
          );
        },
      });
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
  }

  toggleFavorite(): void {
    const product = this.product();

    if (!product) {
      return;
    }

    this.favoritesService.toggle(product.id).subscribe({
      next: (isFavorite) => {
        this.toastService.show({
          title: isFavorite ? 'Guardado en favoritos' : 'Eliminado de favoritos',
          message: `${product.name} ${isFavorite ? 'ya está en tus favoritos' : 'ha salido de tus favoritos'}.`,
        });
      },
      error: (error) => {
        this.toastService.showError(error.error?.message ?? 'No se pudo actualizar el favorito.');
      },
    });
  }

  private loadProduct(productId: number): void {
    this.loading.set(true);

    this.catalogService
      .getProductById(productId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (product) => {
          if (!product) {
            this.product.set(null);
            this.relatedProducts.set([]);
            this.selectedSize.set(null);
            this.toastService.showError('No se encontró el producto solicitado.');
            void this.router.navigate(['/home']);
            return;
          }

          this.product.set(product);
          this.selectedSize.set(null);
          this.loadRelatedProducts(product);
        },
        error: () => {
          this.product.set(null);
          this.relatedProducts.set([]);
          this.selectedSize.set(null);
          this.toastService.showError('No se pudo cargar el producto.');
        },
      });
  }

  private loadRelatedProducts(product: CatalogProduct): void {
    this.catalogService.getProductsByCategoryId(product.categoryId).subscribe({
      next: (products) => {
        this.relatedProducts.set(
          products.filter((candidate) => candidate.id !== product.id).slice(0, 4),
        );
      },
      error: () => {
        this.relatedProducts.set([]);
      },
    });
  }
}
