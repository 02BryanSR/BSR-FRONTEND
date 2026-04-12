import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, map, of, switchMap } from 'rxjs';
import { CatalogProduct } from '../../core/interfaces/catalog.interface';
import { CatalogService } from '../../core/services/catalog.service';
import { UserAddress, UserOrder, UserOrderDetail, UserOrderStatus } from '../../core/interfaces/shop.interface';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';

interface UserOrderDetailView extends UserOrderDetail {
  productName: string;
  imageUrl: string | null;
}

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './my-orders.html',
})
export class MyOrders {
  private readonly catalogService = inject(CatalogService);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly orders = signal<readonly UserOrder[]>([]);
  readonly addresses = signal<readonly UserAddress[]>([]);
  readonly detailsByOrder = signal<Record<number, readonly UserOrderDetailView[]>>({});
  readonly loading = signal(true);
  readonly loadingDetailsOrderId = signal<number | null>(null);
  readonly expandedOrderId = signal<number | null>(null);
  readonly invoiceAction = signal<{ orderId: number; mode: 'preview' | 'download' } | null>(null);
  readonly createdCount = computed(
    () => this.orders().filter((order) => order.status === 'CREATED').length,
  );

  constructor() {
    this.loadOrders();
    this.loadAddresses();
  }

  loadOrders(): void {
    this.loading.set(true);

    this.shopService
      .getMyOrders()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (orders) => {
          const ordered = [...orders].sort((left, right) => right.id - left.id);
          this.orders.set(ordered);
        },
        error: (error) => {
          this.orders.set([]);
          this.toastService.showError(error.error?.message ?? 'No se pudieron cargar tus pedidos.');
        },
      });
  }

  loadAddresses(): void {
    this.shopService.getMyAddresses().subscribe({
      next: (addresses) => this.addresses.set(addresses),
      error: () => this.addresses.set([]),
    });
  }

  toggleDetails(order: UserOrder): void {
    if (this.expandedOrderId() === order.id) {
      this.expandedOrderId.set(null);
      return;
    }

    this.expandedOrderId.set(order.id);

    if (this.detailsByOrder()[order.id]?.length) {
      return;
    }

    this.loadingDetailsOrderId.set(order.id);

    this.shopService
      .getMyOrderDetails(order.id)
      .pipe(
        switchMap((details) => {
          const productIds = details
            .map((detail) => detail.productId)
            .filter((productId): productId is number => productId !== null);

          if (!productIds.length) {
            return of(this.enrichOrderDetails(details, []));
          }

          return this.catalogService
            .getProductsByIds(productIds)
            .pipe(map((products) => this.enrichOrderDetails(details, products)));
        }),
        finalize(() => this.loadingDetailsOrderId.set(null)),
      )
      .subscribe({
        next: (details) => {
          this.detailsByOrder.update((currentDetails) => ({
            ...currentDetails,
            [order.id]: details,
          }));
        },
        error: (error) => {
          this.toastService.showError(
            error.error?.message ?? 'No se pudo cargar el detalle del pedido.',
          );
        },
      });
  }

  isExpanded(orderId: number): boolean {
    return this.expandedOrderId() === orderId;
  }

  getOrderDetails(orderId: number): readonly UserOrderDetailView[] {
    return this.detailsByOrder()[orderId] ?? [];
  }

  previewInvoice(order: UserOrder): void {
    const previewWindow =
      typeof window === 'undefined' ? null : window.open('', '_blank', 'noopener,noreferrer');

    this.openInvoice(order, 'preview', previewWindow);
  }

  downloadInvoice(order: UserOrder): void {
    this.openInvoice(order, 'download');
  }

  isInvoiceBusy(orderId: number): boolean {
    return this.invoiceAction()?.orderId === orderId;
  }

  getAddressLabel(addressId: number | null): string {
    if (addressId === null) {
      return 'Dirección sin asignar';
    }

    const address = this.addresses().find((item) => item.id === addressId);

    if (!address) {
      return `Dirección #${addressId}`;
    }

    return `${address.address}, ${address.city}`;
  }

  statusClasses(status: UserOrderStatus): string {
    switch (status) {
      case 'DELIVERED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'SENT':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      default:
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }
  }

  private enrichOrderDetails(
    details: readonly UserOrderDetail[],
    products: readonly CatalogProduct[],
  ): readonly UserOrderDetailView[] {
    const productsById = new Map(products.map((product) => [product.id, product]));

    return details.map((detail) => {
      const product = detail.productId === null ? null : productsById.get(detail.productId) ?? null;

      return {
        ...detail,
        productName: product?.name ?? (detail.productId === null ? 'Producto' : `Producto #${detail.productId}`),
        imageUrl: product?.imageUrl ?? null,
      };
    });
  }

  private openInvoice(
    order: UserOrder,
    mode: 'preview' | 'download',
    previewWindow: Window | null = null,
  ): void {
    this.invoiceAction.set({ orderId: order.id, mode });

    this.shopService
      .getMyOrderInvoice(order.id, mode === 'download')
      .pipe(finalize(() => this.invoiceAction.set(null)))
      .subscribe({
        next: ({ blob, fileName }) => {
          const objectUrl = URL.createObjectURL(blob);

          if (mode === 'preview') {
            if (previewWindow) {
              previewWindow.location.href = objectUrl;
            } else if (typeof window !== 'undefined') {
              window.open(objectUrl, '_blank', 'noopener,noreferrer');
            }
          } else {
            this.downloadBlob(objectUrl, fileName);
          }

          globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        },
        error: (error) => {
          previewWindow?.close();
          this.toastService.showError(error.error?.message ?? 'No se pudo abrir la factura PDF.');
        },
      });
  }

  private downloadBlob(objectUrl: string, fileName: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();
  }
}
