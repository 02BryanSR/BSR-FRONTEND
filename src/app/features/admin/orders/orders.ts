import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminOrder, OrderStatus } from '../../../core/interfaces/admin.interface';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './orders.html',
})
export class AdminOrders {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly orders = signal<readonly AdminOrder[]>([]);
  readonly loading = signal(true);
  readonly updatingOrderId = signal<number | null>(null);
  readonly expandedOrderId = signal<number | null>(null);
  readonly loadingDetailsOrderId = signal<number | null>(null);
  readonly createdCount = computed(
    () => this.orders().filter((order) => order.status === 'CREATED').length,
  );

  readonly orderStatuses: readonly OrderStatus[] = ['CREATED', 'SENT', 'DELIVERED'];

  constructor() {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);

    this.adminService
      .getOrders()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
        },
        error: () => {
          this.orders.set([]);
          this.toastService.showError(
            'No se pudieron cargar los pedidos. Revisa que el backend admin exponga /api/orders.',
          );
        },
      });
  }

  toggleDetails(order: AdminOrder): void {
    if (this.expandedOrderId() === order.id) {
      this.expandedOrderId.set(null);
      return;
    }

    this.expandedOrderId.set(order.id);

    if (order.items.length) {
      return;
    }

    this.loadingDetailsOrderId.set(order.id);

    this.adminService
      .getOrderItems(order.id)
      .pipe(finalize(() => this.loadingDetailsOrderId.set(null)))
      .subscribe({
        next: (items) => {
          this.orders.update((orders) =>
            orders.map((currentOrder) =>
              currentOrder.id === order.id
                ? {
                    ...currentOrder,
                    items,
                  }
                : currentOrder,
            ),
          );
        },
        error: () => {
          this.toastService.showError('No se pudo cargar el detalle del pedido.');
        },
      });
  }

  updateStatus(order: AdminOrder, nextStatus: string): void {
    if (!this.isOrderStatus(nextStatus) || nextStatus === order.status) {
      return;
    }

    this.updatingOrderId.set(order.id);

    this.adminService
      .updateOrderStatus(order.id, nextStatus)
      .pipe(finalize(() => this.updatingOrderId.set(null)))
      .subscribe({
        next: (updatedOrder) => {
          this.orders.update((orders) =>
            orders.map((currentOrder) =>
              currentOrder.id === updatedOrder.id
                ? {
                    ...currentOrder,
                    ...updatedOrder,
                    items: currentOrder.items.length ? currentOrder.items : updatedOrder.items,
                  }
                : currentOrder,
            ),
          );
          this.toastService.show({
            title: 'Pedido actualizado',
            message: `El pedido #${updatedOrder.id} ya tiene el estado ${updatedOrder.status}.`,
          });
        },
        error: () => {
          this.toastService.showError('No se pudo actualizar el estado del pedido.');
        },
      });
  }

  isExpanded(orderId: number): boolean {
    return this.expandedOrderId() === orderId;
  }

  private isOrderStatus(value: string): value is OrderStatus {
    return this.orderStatuses.includes(value as OrderStatus);
  }
}
