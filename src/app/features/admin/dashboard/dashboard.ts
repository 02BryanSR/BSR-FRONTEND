import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminDashboardData, AdminProduct } from '../../../core/interfaces/admin.interface';
import { AdminService } from '../../../core/services/admin.service';

const EMPTY_DASHBOARD: AdminDashboardData = {
  productCount: 0,
  categoryCount: 0,
  customerCount: 0,
  orderCount: 0,
  salesToday: 0,
  salesMonth: 0,
  salesPreviousMonth: 0,
  salesMonthDelta: 0,
  adminCount: 0,
  activeCustomerCount: 0,
  pendingOrderCount: 0,
  lowStockCount: 0,
  revenueTotal: 0,
  recentProducts: [],
  recentOrders: [],
};

const DASHBOARD_ORDER_STORAGE_KEY = 'bsr.admin.dashboard.recent-products.order.v1';
const DASHBOARD_IMAGE_POSITION_STORAGE_KEY = 'bsr.admin.dashboard.recent-products.image-position.v1';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
})
export class AdminDashboard implements OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });
  private imageDragState:
    | {
        productId: number;
        startClientY: number;
        startPosition: number;
      }
    | null = null;
  private readonly handleImageDragMoveBound = (event: PointerEvent) => this.handleImageDragMove(event);
  private readonly handleImageDragEndBound = () => this.endImageDrag();
  readonly brokenImageIds = signal<readonly number[]>([]);
  readonly draggedProductId = signal<number | null>(null);
  readonly dropTargetProductId = signal<number | null>(null);
  readonly activeImageProductId = signal<number | null>(null);
  readonly recentProductOrder = signal<readonly number[]>(this.readStoredOrder());
  readonly imagePositions = signal<Record<number, number>>(this.readStoredImagePositions());

  readonly dashboard = toSignal(this.adminService.getDashboard(), {
    initialValue: EMPTY_DASHBOARD,
  });
  readonly recentProducts = computed<readonly AdminProduct[]>(() => {
    const products = this.dashboard().recentProducts;
    const storedOrder = this.recentProductOrder();

    if (!storedOrder.length) {
      return products;
    }

    const productsById = new Map(products.map((product) => [product.id, product]));
    const orderedProducts = storedOrder.flatMap((productId) => {
      const product = productsById.get(productId);
      return product ? [product] : [];
    });

    return [
      ...orderedProducts,
      ...products.filter((product) => !storedOrder.includes(product.id)),
    ];
  });

  readonly stats = computed(() => [
    {
      label: 'Clientes',
      value: this.dashboard().customerCount,
      displayValue: String(this.dashboard().customerCount),
      note: 'Usuarios registrados',
      tone: 'neutral' as const,
    },
    {
      label: 'Pedidos',
      value: this.dashboard().orderCount,
      displayValue: String(this.dashboard().orderCount),
      note: 'Pedidos recibidos',
      tone: 'neutral' as const,
    },
    {
      label: 'Compras hoy',
      value: this.dashboard().salesToday,
      displayValue: this.formatCurrency(this.dashboard().salesToday),
      note: 'Total generado hoy',
      tone: 'neutral' as const,
    },
    {
      label: 'Compras mes',
      value: this.dashboard().salesMonth,
      displayValue: this.formatCurrency(this.dashboard().salesMonth),
      note: 'Acumulado del mes actual',
      tone: 'neutral' as const,
    },
    {
      label: 'Mes anterior',
      value: this.dashboard().salesPreviousMonth,
      displayValue: this.formatCurrency(this.dashboard().salesPreviousMonth),
      note: 'Total cerrado del mes anterior',
      tone: 'neutral' as const,
    },
    {
      label: 'Variacion mensual',
      value: this.dashboard().salesMonthDelta,
      displayValue: this.formatDelta(this.dashboard().salesMonthDelta),
      note: this.getMonthDeltaNote(this.dashboard().salesMonthDelta),
      tone: this.getMonthDeltaTone(this.dashboard().salesMonthDelta),
    },
    {
      label: 'Pedidos pendientes',
      value: this.dashboard().pendingOrderCount,
      displayValue: String(this.dashboard().pendingOrderCount),
      note: 'Pedidos en estado creado',
      tone: 'neutral' as const,
    },
    {
      label: 'Stock bajo',
      value: this.dashboard().lowStockCount,
      displayValue: String(this.dashboard().lowStockCount),
      note: 'Productos por debajo del minimo',
      tone: 'neutral' as const,
    },
  ]);

  readonly quickLinks = [
    {
      title: 'Gestionar cátalogo',
      note: 'Categorías, subcategorias y productos conectados',
      route: '/admin/categories',
    },
    {
      title: 'Gestionar clientes',
      note: 'Crear usuarios y activar o desactivar cuentas',
      route: '/admin/customers',
    },
    {
      title: 'Gestionar pedidos',
      note: 'Revisar estados y avance de compra',
      route: '/admin/orders',
    },
  ] as const;

  ngOnDestroy(): void {
    this.endImageDrag();
  }

  isBrokenImage(productId: number): boolean {
    return this.brokenImageIds().includes(productId);
  }

  markImageAsBroken(productId: number): void {
    if (this.brokenImageIds().includes(productId)) {
      return;
    }

    this.brokenImageIds.update((ids) => [...ids, productId]);
  }

  imageSrc(imageUrl: string | null, version: string | null): string | null {
    if (!imageUrl) {
      return null;
    }

    if (!version) {
      return imageUrl;
    }

    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}v=${encodeURIComponent(version)}`;
  }

  displayProductName(name: string | null, id: number): string {
    return name?.trim() || `Producto #${id}`;
  }

  displayCategory(name: string | null): string {
    return name?.trim() || 'Sin categoria';
  }

  displayPrice(value: number | null): string {
    return value === null ? 'Consultar' : this.currencyFormatter.format(value);
  }

  displayStock(value: number | null): string {
    return String(value ?? 0);
  }

  displayImageStatus(imageUrl: string | null, productId: number): string {
    return imageUrl && !this.isBrokenImage(productId) ? 'Imagen conectada' : 'Sin imagen';
  }

  imageObjectPosition(productId: number): string {
    return `center ${this.resolveImagePosition(productId)}%`;
  }

  startCardDrag(event: DragEvent, productId: number): void {
    this.draggedProductId.set(productId);
    this.dropTargetProductId.set(productId);
    event.dataTransfer?.setData('text/plain', String(productId));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onCardDragOver(event: DragEvent, productId: number): void {
    if (this.draggedProductId() === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    if (this.draggedProductId() !== productId) {
      this.dropTargetProductId.set(productId);
    }
  }

  onCardDrop(event: DragEvent, targetProductId: number): void {
    event.preventDefault();

    const sourceProductId = this.draggedProductId();

    if (sourceProductId === null || sourceProductId === targetProductId) {
      this.resetCardDragState();
      return;
    }

    const currentOrder = this.recentProducts().map((product) => product.id);
    const sourceIndex = currentOrder.indexOf(sourceProductId);
    const targetIndex = currentOrder.indexOf(targetProductId);

    if (sourceIndex === -1 || targetIndex === -1) {
      this.resetCardDragState();
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedProductId] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedProductId);

    this.recentProductOrder.set(nextOrder);
    this.writeStoredOrder(nextOrder);
    this.resetCardDragState();
  }

  endCardDrag(): void {
    this.resetCardDragState();
  }

  startImageDrag(event: PointerEvent, productId: number): void {
    event.preventDefault();
    event.stopPropagation();

    this.imageDragState = {
      productId,
      startClientY: event.clientY,
      startPosition: this.resolveImagePosition(productId),
    };
    this.activeImageProductId.set(productId);

    window.addEventListener('pointermove', this.handleImageDragMoveBound);
    window.addEventListener('pointerup', this.handleImageDragEndBound);
    window.addEventListener('pointercancel', this.handleImageDragEndBound);
  }

  getMonthDeltaTone(value: number): 'positive' | 'negative' | 'neutral' {
    if (value > 0) {
      return 'positive';
    }

    if (value < 0) {
      return 'negative';
    }

    return 'neutral';
  }

  private getMonthDeltaNote(value: number): string {
    if (value > 0) {
      return 'Positivo frente al mes anterior';
    }

    if (value < 0) {
      return 'Negativo frente al mes anterior';
    }

    return 'Sin variacion frente al mes anterior';
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  private formatDelta(value: number): string {
    if (value > 0) {
      return `+${this.formatCurrency(value)}`;
    }

    if (value < 0) {
      return `-${this.formatCurrency(Math.abs(value))}`;
    }

    return this.formatCurrency(0);
  }

  private handleImageDragMove(event: PointerEvent): void {
    if (!this.imageDragState) {
      return;
    }

    const deltaY = event.clientY - this.imageDragState.startClientY;
    const nextPosition = this.clamp(this.imageDragState.startPosition + deltaY * 0.35, 0, 100);

    this.imagePositions.update((positions) => ({
      ...positions,
      [this.imageDragState!.productId]: nextPosition,
    }));
  }

  private endImageDrag(): void {
    if (this.imageDragState) {
      this.writeStoredImagePositions(this.imagePositions());
    }

    this.imageDragState = null;
    this.activeImageProductId.set(null);

    window.removeEventListener('pointermove', this.handleImageDragMoveBound);
    window.removeEventListener('pointerup', this.handleImageDragEndBound);
    window.removeEventListener('pointercancel', this.handleImageDragEndBound);
  }

  private resetCardDragState(): void {
    this.draggedProductId.set(null);
    this.dropTargetProductId.set(null);
  }

  private resolveImagePosition(productId: number): number {
    return this.clamp(this.imagePositions()[productId] ?? 50, 0, 100);
  }

  private readStoredOrder(): readonly number[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const rawValue = localStorage.getItem(DASHBOARD_ORDER_STORAGE_KEY);
      const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];

      return Array.isArray(parsedValue)
        ? parsedValue.flatMap((value) => {
            const productId = Number(value);
            return Number.isInteger(productId) && productId > 0 ? [productId] : [];
          })
        : [];
    } catch {
      return [];
    }
  }

  private writeStoredOrder(order: readonly number[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(DASHBOARD_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {}
  }

  private readStoredImagePositions(): Record<number, number> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const rawValue = localStorage.getItem(DASHBOARD_IMAGE_POSITION_STORAGE_KEY);
      const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : {};

      if (!parsedValue || typeof parsedValue !== 'object') {
        return {};
      }

      return Object.fromEntries(
        Object.entries(parsedValue as Record<string, unknown>).flatMap(([productId, position]) => {
          const normalizedId = Number(productId);
          const normalizedPosition = Number(position);

          return Number.isInteger(normalizedId) && normalizedId > 0 && Number.isFinite(normalizedPosition)
            ? [[normalizedId, this.clamp(normalizedPosition, 0, 100)]]
            : [];
        }),
      );
    } catch {
      return {};
    }
  }

  private writeStoredImagePositions(positions: Record<number, number>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(DASHBOARD_IMAGE_POSITION_STORAGE_KEY, JSON.stringify(positions));
    } catch {}
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
  }
}
