import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  CreateOrderInput,
  UserAddress,
  UserAddressInput,
  UserCart,
  UserCartItem,
  UserOrder,
  UserOrderDetail,
  UserOrderStatus,
} from '../interfaces/shop.interface';

type JsonObject = Record<string, unknown>;
const CART_SIZE_STORAGE_KEY = 'bsr.cart.itemSizes';

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
  private readonly cartState = signal<UserCart>(EMPTY_CART);
  private readonly cartItemSizes = signal<Record<number, string>>(this.loadStoredCartItemSizes());

  readonly cart = this.cartState.asReadonly();
  readonly cartItemCount = computed(() => this.cartState().totalProducts);

  loadMyCart(): Observable<UserCart> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.cart).pipe(
      map((response) => this.applyStoredSelections(this.mapCart(response))),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  addItem(productId: number, quantity = 1, size: string | null = null): Observable<UserCart> {
    const params = new HttpParams()
      .set('productId', productId)
      .set('quantity', quantity);

    return this.http.post<unknown>(API_ENDPOINTS.shop.cartItems, null, { params }).pipe(
      map((response) => {
        if (size?.trim()) {
          this.setStoredCartItemSize(productId, size);
        }

        return this.applyStoredSelections(this.mapCart(response));
      }),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  updateItemQuantity(productId: number, quantity: number): Observable<UserCart> {
    const params = new HttpParams().set('quantity', quantity);

    return this.http.put<unknown>(API_ENDPOINTS.shop.cartItem(productId), null, { params }).pipe(
      map((response) => this.applyStoredSelections(this.mapCart(response))),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  removeItem(productId: number): Observable<UserCart> {
    return this.http.delete<unknown>(API_ENDPOINTS.shop.cartItem(productId)).pipe(
      map((response) => {
        this.setStoredCartItemSize(productId, null);
        return this.applyStoredSelections(this.mapCart(response));
      }),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  clearCart(): Observable<UserCart> {
    return this.http.delete<unknown>(API_ENDPOINTS.shop.cart).pipe(
      map((response) => {
        this.clearStoredCartItemSizes();
        return this.applyStoredSelections(this.mapCart(response));
      }),
      tap((cart) => this.cartState.set(cart)),
    );
  }

  resetCart(): void {
    this.clearStoredCartItemSizes();
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

  getMyOrder(id: number): Observable<UserOrder> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.order(id)).pipe(
      map((response) => this.mapOrder(response)),
    );
  }

  getMyOrderDetails(id: number): Observable<readonly UserOrderDetail[]> {
    return this.http.get<unknown>(API_ENDPOINTS.shop.orderDetails(id)).pipe(
      map((response) => this.asArray(response).map((item) => this.mapOrderDetail(item))),
    );
  }

  createMyOrder(payload: CreateOrderInput): Observable<UserOrder> {
    return this.http.post<unknown>(API_ENDPOINTS.shop.orders, payload).pipe(
      map((response) => this.mapOrder(response)),
      tap(() => this.resetCart()),
    );
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
    const productId = this.toNumber(this.pick(source, ['productId'])) ?? 0;

    return {
      productId,
      productName: this.toStringValue(this.pick(source, ['productName'])) || 'Producto',
      size:
        this.toStringValue(this.pick(source, ['size', 'talla', 'variant', 'variantName'])) ??
        this.cartItemSizes()[productId] ??
        null,
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
      subtotal: priceUnit === null ? null : priceUnit * quantity,
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

  private applyStoredSelections(cart: UserCart): UserCart {
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        size: item.size ?? this.cartItemSizes()[item.productId] ?? null,
      })),
    };
  }

  private loadStoredCartItemSizes(): Record<number, string> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const rawValue = localStorage.getItem(CART_SIZE_STORAGE_KEY);

      if (!rawValue) {
        return {};
      }

      const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;

      return Object.entries(parsedValue).reduce<Record<number, string>>((accumulator, [key, value]) => {
        const productId = Number(key);
        const size = typeof value === 'string' ? value.trim() : '';

        if (!Number.isFinite(productId) || !size) {
          return accumulator;
        }

        accumulator[productId] = size;
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  }

  private setStoredCartItemSize(productId: number, size: string | null): void {
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    const normalizedSize = size?.trim() || null;

    this.cartItemSizes.update((currentSizes) => {
      const nextSizes = { ...currentSizes };

      if (normalizedSize) {
        nextSizes[productId] = normalizedSize;
      } else {
        delete nextSizes[productId];
      }

      this.persistStoredCartItemSizes(nextSizes);
      return nextSizes;
    });
  }

  private clearStoredCartItemSizes(): void {
    this.cartItemSizes.set({});
    this.persistStoredCartItemSizes({});
  }

  private persistStoredCartItemSizes(sizes: Record<number, string>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(CART_SIZE_STORAGE_KEY, JSON.stringify(sizes));
    } catch {
      // Ignore storage errors to keep the cart usable even if persistence fails.
    }
  }
}
