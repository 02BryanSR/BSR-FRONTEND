import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.html',
})
export class Cart {
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly cart = this.shopService.cart;
  readonly loading = signal(true);
  readonly updatingItemId = signal<number | null>(null);
  readonly clearing = signal(false);
  readonly hasItems = computed(() => this.cart().items.length > 0);

  constructor() {
    this.loadCart();
  }

  loadCart(): void {
    this.loading.set(true);

    this.shopService
      .loadMyCart()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo cargar el carrito.');
        },
      });
  }

  decrease(itemId: number, quantity: number): void {
    if (quantity <= 1) {
      this.remove(itemId);
      return;
    }

    this.updateQuantity(itemId, quantity - 1);
  }

  increase(itemId: number, quantity: number): void {
    this.updateQuantity(itemId, quantity + 1);
  }

  remove(itemId: number): void {
    this.updatingItemId.set(itemId);

    this.shopService
      .removeItem(itemId)
      .pipe(finalize(() => this.updatingItemId.set(null)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Producto eliminado',
            message: 'El producto se ha quitado del carrito.',
          });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo quitar el producto.');
        },
      });
  }

  clear(): void {
    const confirmed = window.confirm('Quieres vaciar todo el carrito?');

    if (!confirmed) {
      return;
    }

    this.clearing.set(true);

    this.shopService
      .clearCart()
      .pipe(finalize(() => this.clearing.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Carrito vaciado',
            message: 'Tu carrito ha quedado vacío.',
          });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo vaciar el carrito.');
        },
      });
  }

  goToCheckout(): void {
    void this.router.navigate(['/checkout']);
  }

  private updateQuantity(itemId: number, quantity: number): void {
    this.updatingItemId.set(itemId);

    this.shopService
      .updateItemQuantity(itemId, quantity)
      .pipe(finalize(() => this.updatingItemId.set(null)))
      .subscribe({
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo actualizar la cantidad.');
        },
      });
  }
}
