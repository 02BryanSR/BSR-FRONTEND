import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { resolveAvailableProductSizes } from '../../core/constants/product-size.constants';
import { CatalogCategory } from '../../core/interfaces/catalog.interface';
import { UserFavorite } from '../../core/interfaces/shop.interface';
import { CatalogService } from '../../core/services/catalog.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './favorites.html',
})
export class Favorites {
  private readonly catalogService = inject(CatalogService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly categories = toSignal(this.catalogService.getCategories(), {
    initialValue: [] as readonly CatalogCategory[],
  });
  readonly favorites = this.favoritesService.items;
  readonly loading = signal(true);
  readonly removingProductId = signal<number | null>(null);
  readonly addingProductId = signal<number | null>(null);
  readonly sizeLoadingProductId = signal<number | null>(null);
  readonly pendingFavorite = signal<UserFavorite | null>(null);
  readonly pendingSizes = signal<readonly string[]>([]);
  readonly selectedSize = signal<string | null>(null);
  readonly hasItems = computed(() => this.favorites().length > 0);
  readonly pricedCount = computed(
    () => this.favorites().filter((item) => item.productPrice !== null).length,
  );

  constructor() {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.loading.set(true);

    this.favoritesService
      .loadMyFavorites()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudieron cargar tus favoritos.');
        },
      });
  }

  remove(favorite: UserFavorite): void {
    this.removingProductId.set(favorite.productId);

    this.favoritesService
      .remove(favorite.productId)
      .pipe(finalize(() => this.removingProductId.set(null)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Favorito eliminado',
            message: `${favorite.productName} ha salido de tus favoritos.`,
          });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo eliminar el favorito.');
        },
      });
  }

  addToCart(favorite: UserFavorite): void {
    if ((favorite.productStock ?? 0) <= 0) {
      this.toastService.showError('Producto agotado. Ya no se puede añadir al carrito.');
      return;
    }

    this.sizeLoadingProductId.set(favorite.productId);

    this.catalogService
      .getProductById(favorite.productId)
      .pipe(finalize(() => this.sizeLoadingProductId.set(null)))
      .subscribe({
        next: (product) => {
          if (!product) {
            this.toastService.showError('No se pudo cargar la talla disponible de este producto.');
            return;
          }

          const sizes = resolveAvailableProductSizes(product, this.categories());

          if (!sizes.length) {
            this.confirmAddToCart(favorite, null);
            return;
          }

          this.pendingFavorite.set(favorite);
          this.pendingSizes.set(sizes);
          this.selectedSize.set(null);
        },
        error: () => {
          this.toastService.showError('No se pudo preparar la selección de talla.');
        },
      });
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
  }

  closeSizePicker(): void {
    this.pendingFavorite.set(null);
    this.pendingSizes.set([]);
    this.selectedSize.set(null);
  }

  confirmPendingAddToCart(): void {
    const favorite = this.pendingFavorite();
    const selectedSize = this.selectedSize();

    if (!favorite) {
      return;
    }

    if (this.pendingSizes().length && !selectedSize) {
      this.toastService.show({
        title: 'Selecciona una talla',
        message: 'Elige tu talla antes de añadir el producto al carrito.',
      });
      return;
    }

    this.confirmAddToCart(favorite, selectedSize);
  }

  private confirmAddToCart(favorite: UserFavorite, size: string | null): void {
    this.addingProductId.set(favorite.productId);

    this.shopService
      .addItem(favorite.productId, 1, size)
      .pipe(finalize(() => this.addingProductId.set(null)))
      .subscribe({
        next: () => {
          this.closeSizePicker();
          this.toastService.show({
            title: 'Producto añadido',
            message: `${favorite.productName}${size ? ` en talla ${size}` : ''} ya está en tu carrito.`,
          });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo añadir al carrito.');
        },
      });
  }
}
