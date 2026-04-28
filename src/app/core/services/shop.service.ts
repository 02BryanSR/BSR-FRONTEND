import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { computed, effect, Injectable, inject, signal, untracked } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  CheckoutPaymentIntent,
  ConfirmPaymentInput,
  CreateOrderInput,
  CreatePaymentIntentInput,
  OrderInvoiceFile,
  UserAddress,
  UserAddressInput,
  UserCart,
  UserCartItem,
  UserOrder,
  UserOrderDetail,
  UserOrderStatus,
} from '../interfaces/shop.interface';
import { AuthService } from './auth.service';

type JsonObject = Record<string, unknown>;
type CartSyncReason =
  | 'auth-restored'
  | 'cart-updated'
  | 'external-update'
  | 'tab-focused'
  | 'poll';

interface CartSyncPayload {
  eventId: string;
  ownerKey: string;
  reason: CartSyncReason;
  sourceId: string;
  timestamp: number;
}

const CART_SYNC_STORAGE_KEY = 'bsr.cart.sync';
const CART_SYNC_CHANNEL_NAME = 'bsr.cart.sync';
const CART_SYNC_POLL_INTERVAL_MS = 15000;

const EMPTY_CART: UserCart = {
  cartId: null,
  customerId: null,
  total: 0,
  totalProducts: 0,
  items: [],
};

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly cartState = signal<UserCart>(EMPTY_CART);
  private readonly syncSourceId = `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private readonly cartSyncChannel = this.createCartSyncChannel();
  private cartRefreshInFlight = false;

  readonly cart = this.cartState.asReadonly();
  readonly cartItemCount = computed(() => this.cartState().totalProducts);

  constructor() {
    this.registerCartSessionEffect();
    this.registerBrowserSync();
  }

  loadMyCart(): Observable<UserCart> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.cart).pipe(
      map((response) => this.mapCart(response)),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  addItem(productId: number, quantity = 1, size: string | null = null): Observable<UserCart> {
    let params = new HttpParams()
      .set('productId', productId)
      .set('quantity', quantity);

    const normalizedSize = size?.trim() || null;

    if (normalizedSize) {
      params = params.set('size', normalizedSize);
    }

    return this.http.post<unknown>(API_ENDPOINTS.shop.cartItems, null, { params }).pipe(
      map((response) => this.mapCart(response)),
      tap((cart) => {
        this.cartState.set(cart);
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  updateItemQuantity(itemId: number, quantity: number): Observable<UserCart> {
    const params = new HttpParams().set('quantity', quantity);

    return this.http.put<unknown>(API_ENDPOINTS.shop.cartItem(itemId), null, { params }).pipe(
      map((response) => this.mapCart(response)),
      tap((cart) => {
        this.cartState.set(cart);
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  removeItem(itemId: number): Observable<UserCart> {
    return this.http.delete<unknown>(API_ENDPOINTS.shop.cartItem(itemId)).pipe(
      map((response) => this.mapCart(response)),
      tap((cart) => {
        this.cartState.set(cart);
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  clearCart(): Observable<UserCart> {
    return this.http.delete<unknown>(API_ENDPOINTS.shop.cart).pipe(
      map((response) => this.mapCart(response)),
      tap((cart) => {
        this.cartState.set(cart);
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  resetCart(): void {
    this.cartState.set(EMPTY_CART);
  }

  getMyAddresses(): Observable<readonly UserAddress[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.addresses).pipe(
      map((response) => this.asArray(response).map((item) => this.mapAddress(item))),
    );
  }

  createMyAddress(payload: UserAddressInput): Observable<UserAddress> {
    return this.http.post<unknown>(API_ENDPOINTS.shop.addresses, payload).pipe(
      map((response) => this.mapAddress(response)),
    );
  }

  updateMyAddress(id: number, payload: UserAddressInput): Observable<UserAddress> {
    return this.http.patch<unknown>(API_ENDPOINTS.shop.address(id), payload).pipe(
      map((response) => this.mapAddress(response)),
    );
  }

  deleteMyAddress(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.shop.address(id));
  }

  getMyOrders(): Observable<readonly UserOrder[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.orders).pipe(
      map((response) => this.asArray(response).map((item) => this.mapOrder(item))),
    );
  }

  getMyOrderDetails(id: number): Observable<readonly UserOrderDetail[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.orderDetails(id)).pipe(
      map((response) => this.asArray(response).map((item) => this.mapOrderDetail(item))),
    );
  }

  getMyOrderInvoice(id: number, download = false): Observable<OrderInvoiceFile> {
    const params = new HttpParams().set('download', download);

    return this.http
      .get(API_ENDPOINTS.shop.orderInvoice(id), {
        observe: 'response',
        responseType: 'blob',
        params,
      })
      .pipe(
        map((response) => ({
          blob: response.body ?? new Blob([], { type: 'application/pdf' }),
          fileName: this.resolveInvoiceFilename(response, id),
        })),
      );
  }

  createMyOrder(payload: CreateOrderInput): Observable<UserOrder> {
    return this.http.post<unknown>(API_ENDPOINTS.shop.orders, payload).pipe(
      map((response) => this.mapOrder(response)),
      tap(() => {
        this.resetCart();
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  createPaymentIntent(payload: CreatePaymentIntentInput): Observable<CheckoutPaymentIntent> {
    return this.http.post<unknown>(API_ENDPOINTS.shop.paymentIntent, payload).pipe(
      map((response) => this.mapPaymentIntent(response)),
    );
  }

  confirmPayment(payload: ConfirmPaymentInput): Observable<UserOrder> {
    return this.http.post<unknown>(API_ENDPOINTS.shop.confirmPayment, payload).pipe(
      map((response) => this.mapOrder(response)),
      tap(() => {
        this.resetCart();
        this.broadcastCartChange('cart-updated');
      }),
    );
  }

  private registerCartSessionEffect(): void {
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();

      untracked(() => {
        if (isAuthenticated) {
          this.refreshCartFromServer();
          return;
        }

        this.cartState.set(EMPTY_CART);
      });
    });
  }

  private registerBrowserSync(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    window.addEventListener('storage', this.handleStorageEvent);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.refreshCartFromServer();
      }
    }, CART_SYNC_POLL_INTERVAL_MS);

    this.cartSyncChannel?.addEventListener('message', this.handleCartSyncMessage);
  }

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== CART_SYNC_STORAGE_KEY) {
      return;
    }

    this.handleExternalCartSync(this.parseCartSyncPayload(event.newValue));
  };

  private readonly handleWindowFocus = (): void => {
    this.refreshCartFromServer();
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }

    this.refreshCartFromServer();
  };

  private readonly handleCartSyncMessage = (event: MessageEvent<CartSyncPayload>): void => {
    this.handleExternalCartSync(event.data);
  };

  private refreshCartFromServer(): void {
    if (!this.authService.isAuthenticated() || this.cartRefreshInFlight) {
      return;
    }

    this.cartRefreshInFlight = true;

    this.loadMyCart()
      .pipe(
        catchError(() => EMPTY),
        finalize(() => {
          this.cartRefreshInFlight = false;
        }),
      )
      .subscribe();
  }

  private broadcastCartChange(reason: CartSyncReason): void {
    const payload = this.buildCartSyncPayload(reason);

    if (!payload) {
      return;
    }

    try {
      this.cartSyncChannel?.postMessage(payload);
    } catch {
    }

    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(CART_SYNC_STORAGE_KEY, JSON.stringify(payload));
  }

  private buildCartSyncPayload(reason: CartSyncReason): CartSyncPayload | null {
    const ownerKey = this.getCartStorageOwnerKey();

    if (!ownerKey) {
      return null;
    }

    return {
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ownerKey,
      reason,
      sourceId: this.syncSourceId,
      timestamp: Date.now(),
    };
  }

  private handleExternalCartSync(payload: CartSyncPayload | null): void {
    const ownerKey = this.getCartStorageOwnerKey();

    if (!payload || !ownerKey || payload.ownerKey !== ownerKey || payload.sourceId === this.syncSourceId) {
      return;
    }

    this.refreshCartFromServer();
  }

  private parseCartSyncPayload(rawValue: string | null): CartSyncPayload | null {
    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<CartSyncPayload>;

      if (
        typeof parsedValue.ownerKey !== 'string' ||
        !parsedValue.ownerKey.trim() ||
        typeof parsedValue.sourceId !== 'string' ||
        !parsedValue.sourceId.trim()
      ) {
        return null;
      }

      const normalizedReason =
        parsedValue.reason === 'auth-restored' ||
        parsedValue.reason === 'cart-updated' ||
        parsedValue.reason === 'external-update' ||
        parsedValue.reason === 'tab-focused' ||
        parsedValue.reason === 'poll'
          ? parsedValue.reason
          : 'cart-updated';

      return {
        eventId:
          typeof parsedValue.eventId === 'string' && parsedValue.eventId.trim()
            ? parsedValue.eventId
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ownerKey: parsedValue.ownerKey.trim(),
        reason: normalizedReason,
        sourceId: parsedValue.sourceId.trim(),
        timestamp:
          typeof parsedValue.timestamp === 'number' && Number.isFinite(parsedValue.timestamp)
            ? parsedValue.timestamp
            : Date.now(),
      };
    } catch {
      return null;
    }
  }

  private createCartSyncChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') {
      return null;
    }

    try {
      return new BroadcastChannel(CART_SYNC_CHANNEL_NAME);
    } catch {
      return null;
    }
  }

  private getCartStorageOwnerKey(): string | null {
    const email = this.authService.currentUser()?.email?.trim().toLowerCase() ?? '';
    return email || null;
  }

  private mapCart(input: unknown): UserCart {
    const source = this.asObject(input);
    const items = this.asArray(this.pick(source, ['items'])).map((item) => this.mapCartItem(item));

    return {
      cartId: this.toNumber(this.pick(source, ['cartId'])) ?? null,
      customerId: this.toNumber(this.pick(source, ['customerId'])) ?? null,
      total: this.toNumber(this.pick(source, ['total'])) ?? 0,
      totalProducts: this.toNumber(this.pick(source, ['totalProducts'])) ?? 0,
      items,
    };
  }

  private mapCartItem(input: unknown): UserCartItem {
    const source = this.asObject(input);

    return {
      id: this.toNumber(this.pick(source, ['id', 'itemId'])) ?? 0,
      productId: this.toNumber(this.pick(source, ['productId'])) ?? 0,
      productName: this.toStringValue(this.pick(source, ['productName'])) || 'Producto',
      size:
        this.toStringValue(this.pick(source, ['size', 'talla', 'variant', 'variantName'])) ?? null,
      price: this.toNumber(this.pick(source, ['price'])),
      quantity: this.toNumber(this.pick(source, ['quantity'])) ?? 0,
      subtotal: this.toNumber(this.pick(source, ['subtotal'])),
    };
  }

  private mapAddress(input: unknown): UserAddress {
    const source = this.asObject(input);

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      address: this.toStringValue(this.pick(source, ['address'])) || '',
      city: this.toStringValue(this.pick(source, ['city'])) || '',
      country: this.toStringValue(this.pick(source, ['country'])) || '',
      cp: this.toStringValue(this.pick(source, ['cp'])) || '',
      state: this.toStringValue(this.pick(source, ['state'])) || '',
      customerId: this.toNumber(this.pick(source, ['customerId'])),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
      updatedAt: this.toStringValue(this.pick(source, ['updateDate', 'updatedAt'])),
    };
  }

  private mapOrder(input: unknown): UserOrder {
    const source = this.asObject(input);

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      status: this.normalizeOrderStatus(this.toStringValue(this.pick(source, ['status']))),
      totalAmount: this.toNumber(this.pick(source, ['totalAmount'])) ?? 0,
      totalPrice: this.toNumber(this.pick(source, ['totalPrice'])) ?? 0,
      payMethod: this.toStringValue(this.pick(source, ['payMethod'])) || '',
      customerId: this.toNumber(this.pick(source, ['customerId'])),
      addressId: this.toNumber(this.pick(source, ['addressId'])),
      orderDetailIds: this.asNumberArray(this.pick(source, ['orderDetailIds'])),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
      updatedAt: this.toStringValue(this.pick(source, ['updateDate', 'updatedAt'])),
    };
  }

  private mapOrderDetail(input: unknown): UserOrderDetail {
    const source = this.asObject(input);
    const quantity = this.toNumber(this.pick(source, ['quantity'])) ?? 0;
    const priceUnit = this.toNumber(this.pick(source, ['priceUnit']));

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      quantity,
      priceUnit,
      productId: this.toNumber(this.pick(source, ['productId'])),
      orderId: this.toNumber(this.pick(source, ['orderId'])),
      size:
        this.toStringValue(this.pick(source, ['size', 'talla', 'variant', 'variantName'])) ?? null,
      subtotal: priceUnit === null ? null : priceUnit * quantity,
    };
  }

  private mapPaymentIntent(input: unknown): CheckoutPaymentIntent {
    const source = this.asObject(input);

    return {
      clientSecret:
        this.toStringValue(this.pick(source, ['clientSecret', 'client_secret'])) || '',
      paymentIntentId:
        this.toStringValue(this.pick(source, ['paymentIntentId', 'payment_intent_id'])) || null,
      amount: this.toNumber(this.pick(source, ['amount'])),
      currency:
        this.toStringValue(this.pick(source, ['currency']))?.toUpperCase() || 'EUR',
    };
  }

  private normalizeOrderStatus(value: string | null): UserOrderStatus {
    switch (value?.trim().toUpperCase()) {
      case 'SENT':
      case 'DELIVERED':
        return value.trim().toUpperCase() as UserOrderStatus;
      default:
        return 'CREATED';
    }
  }

  private asArray(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asNumberArray(value: unknown): readonly number[] {
    return this.asArray(value).flatMap((item) => {
      const numericValue = this.toNumber(item);
      return numericValue === null ? [] : [numericValue];
    });
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

  private toStringValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized ? normalized : null;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const normalized = Number(value);
      return Number.isFinite(normalized) ? normalized : null;
    }

    return null;
  }

  private resolveInvoiceFilename(response: HttpResponse<Blob>, orderId: number): string {
    const disposition = response.headers.get('content-disposition') ?? '';
    const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);

    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1]);
    }

    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);

    if (plainMatch?.[1]) {
      return plainMatch[1];
    }

    return `factura-bsr-${String(orderId).padStart(6, '0')}.pdf`;
  }
}
