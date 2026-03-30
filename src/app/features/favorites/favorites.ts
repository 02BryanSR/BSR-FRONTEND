import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UserFavorite } from '../../core/interfaces/shop.interface';
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
  private readonly favoritesService = inject(FavoritesService);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly favorites = this.favoritesService.items;
  readonly loading = signal(true);
  readonly removingProductId = signal<number | null>(null);
  readonly addingProductId = signal<number | null>(null);
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

    this.addingProductId.set(favorite.productId);

    this.shopService
      .addItem(favorite.productId, 1)
      .pipe(finalize(() => this.addingProductId.set(null)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Producto añadido',
            message: `${favorite.productName} ya está en tu carrito.`,
          });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo añadir al carrito.');
        },
      });
  }
}
