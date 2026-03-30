import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api.constants';
import {
  AdminCategory,
  AdminCategoryInput,
  AdminCustomer,
  AdminCustomerInput,
  AdminDashboardData,
  AdminOrder,
  AdminOrderItem,
  AdminProduct,
  AdminProductInput,
  OrderStatus,
} from '../interfaces/admin.interface';
import { UserStatus } from '../interfaces/user.interface';

type JsonObject = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<AdminDashboardData> {
    return forkJoin({
      products: this.getProducts().pipe(catchError(() => of([] as readonly AdminProduct[]))),
      categories: this.getCategories().pipe(catchError(() => of([] as readonly AdminCategory[]))),
      customers: this.getCustomers().pipe(catchError(() => of([] as readonly AdminCustomer[]))),
      orders: this.getOrders().pipe(catchError(() => of([] as readonly AdminOrder[]))),
    }).pipe(
      map(({ products, categories, customers, orders }) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const categoriesById = new Map(categories.map((category) => [category.id, category.name]));
        const normalizedProducts = products.map((product) => ({
          ...product,
          categoryName:
            (product.categoryId !== null ? categoriesById.get(product.categoryId) : null) ||
            product.categoryName,
        }));
        const recentProducts = [...normalizedProducts]
          .sort(
            (left, right) =>
              this.toDateMs(right.updatedAt ?? right.createdAt) -
              this.toDateMs(left.updatedAt ?? left.createdAt),
          )
          .slice(0, 5);
        const recentOrders = [...orders]
          .sort((left, right) => this.toDateMs(right.createdAt) - this.toDateMs(left.createdAt))
          .slice(0, 5);
        const salesToday = orders.reduce((total, order) => {
          const createdAtMs = this.toDateMs(order.createdAt);

          if (createdAtMs < startOfToday || createdAtMs >= startOfNextDay) {
            return total;
          }

          return total + (order.total ?? 0);
        }, 0);
        const salesMonth = orders.reduce((total, order) => {
          const createdAtMs = this.toDateMs(order.createdAt);

          if (createdAtMs < startOfMonth || createdAtMs >= startOfNextDay) {
            return total;
          }

          return total + (order.total ?? 0);
        }, 0);
        const salesPreviousMonth = orders.reduce((total, order) => {
          const createdAtMs = this.toDateMs(order.createdAt);

          if (createdAtMs < startOfPreviousMonth || createdAtMs >= startOfMonth) {
            return total;
          }

          return total + (order.total ?? 0);
        }, 0);

        return {
          productCount: normalizedProducts.length,
          categoryCount: categories.length,
          customerCount: customers.length,
          orderCount: orders.length,
          salesToday,
          salesMonth,
          salesPreviousMonth,
          salesMonthDelta: salesMonth - salesPreviousMonth,
          adminCount: customers.filter((customer) => customer.role === 'admin').length,
          activeCustomerCount: customers.filter((customer) => customer.enabled).length,
          pendingOrderCount: orders.filter((order) => order.status === 'CREATED').length,
          lowStockCount: normalizedProducts.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5)
            .length,
          revenueTotal: orders.reduce((total, order) => total + (order.total ?? 0), 0),
          recentProducts,
          recentOrders,
        };
      }),
    );
  }

  getProducts(): Observable<readonly AdminProduct[]> {
    return this.http.get<unknown>(API_ENDPOINTS.admin.products).pipe(
      map((response) => this.asArray(response).map((item) => this.mapProd(item))),
    );
  }

  createProduct(payload: AdminProductInput): Observable<AdminProduct> {
    return this.http
      .post<unknown>(API_ENDPOINTS.admin.products, this.buildProdFormData(payload))
      .pipe(map((response) => this.mapProd(response)));
  }

  updateProduct(id: number, payload: AdminProductInput): Observable<AdminProduct> {
    return this.http
      .put<unknown>(API_ENDPOINTS.admin.product(id), this.buildProdFormData(payload))
      .pipe(map((response) => this.mapProd(response)));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.admin.product(id));
  }

  getCategories(): Observable<readonly AdminCategory[]> {
    return this.http.get<unknown>(API_ENDPOINTS.admin.categories).pipe(
      map((response) => this.asArray(response).map((item) => this.mapCat(item))),
    );
  }

  createCategory(payload: AdminCategoryInput): Observable<AdminCategory> {
    return this.http
      .post<unknown>(API_ENDPOINTS.admin.categories, this.buildCatFormData(payload))
      .pipe(map((response) => this.mapCat(response)));
  }

  updateCategory(id: number, payload: AdminCategoryInput): Observable<AdminCategory> {
    return this.http
      .patch<unknown>(API_ENDPOINTS.admin.category(id), this.buildCatFormData(payload))
      .pipe(map((response) => this.mapCat(response)));
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.admin.category(id));
  }

  getCustomers(): Observable<readonly AdminCustomer[]> {
    return this.http.get<unknown>(API_ENDPOINTS.admin.customers).pipe(
      map((response) => this.asArray(response).map((item) => this.mapCust(item))),
    );
  }

  createCustomer(payload: AdminCustomerInput): Observable<AdminCustomer> {
    return this.http
      .post<unknown>(API_ENDPOINTS.admin.customers, this.buildCustPayload(payload))
      .pipe(map((response) => this.mapCust(response)));
  }

  updateCustomer(id: number, payload: AdminCustomerInput): Observable<AdminCustomer> {
    return this.http
      .patch<unknown>(API_ENDPOINTS.admin.customer(id), this.buildCustPayload(payload))
      .pipe(map((response) => this.mapCust(response)));
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.admin.customer(id));
  }

  getOrders(): Observable<readonly AdminOrder[]> {
    return this.http.get<unknown>(API_ENDPOINTS.admin.orders).pipe(
      map((response) => this.asArray(response).map((item) => this.mapOrd(item))),
    );
  }

  getOrderItems(orderId: number): Observable<readonly AdminOrderItem[]> {
    return forkJoin({
      details: this.http.get<unknown>(API_ENDPOINTS.admin.orderDetails(orderId)).pipe(
        map((response) => this.asArray(response)),
        catchError(() => of([] as readonly unknown[])),
      ),
      products: this.getProducts().pipe(catchError(() => of([] as readonly AdminProduct[]))),
    }).pipe(
      map(({ details, products }) => {
        const productsById = new Map(products.map((product) => [product.id, product]));

        return details.map((item) => this.mapOrdItem(item, productsById));
      }),
    );
  }

  updateOrderStatus(id: number, status: OrderStatus): Observable<AdminOrder> {
    return this.http
      .patch<unknown>(
        API_ENDPOINTS.admin.orderStatus(id),
        {
          status,
          estado: status,
        },
        {
          params: new HttpParams().set('status', status),
        },
      )
      .pipe(map((response) => this.mapOrd(response)));
  }

  private buildProdFormData(payload: AdminProductInput): FormData {
    const formData = new FormData();

    formData.append('name', payload.name.trim());
    formData.append('sku', payload.sku.trim());
    formData.append('description', payload.description.trim());
    formData.append('price', String(payload.price));
    formData.append('stock', String(payload.stock));
    formData.append('categoryId', String(payload.categoryId));

    const imageUrl = this.normalizePersistedImageUrl(payload.imageUrl);

    if (imageUrl) {
      formData.append('imageUrl', imageUrl);
    }

    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }

    return formData;
  }

  private buildCatFormData(payload: AdminCategoryInput): FormData {
    const formData = new FormData();

    formData.append('name', payload.name.trim());
    formData.append('description', payload.description.trim());

    const imageUrl = this.normalizePersistedImageUrl(payload.imageUrl);

    if (imageUrl) {
      formData.append('imageUrl', imageUrl);
    }

    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }

    return formData;
  }

  private buildCustPayload(payload: AdminCustomerInput): JsonObject {
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();

    return {
      email: payload.email.trim(),
      name: firstName,
      lastName,
      number: payload.number,
      role: payload.role.toUpperCase(),
      enabled: payload.enabled,
      ...(payload.password?.trim() ? { password: payload.password.trim() } : {}),
    };
  }

  private normalizePersistedImageUrl(value: string | null): string | null {
    const normalizedValue = value?.trim() || null;

    if (!normalizedValue) {
      return null;
    }

    if (normalizedValue.startsWith('blob:') || normalizedValue.startsWith('data:')) {
      return null;
    }

    return normalizedValue;
  }

  private mapCat(input: unknown): AdminCategory {
    const source = this.asObject(input);
    const rawName = this.toStringValue(this.pick(source, ['name']));

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      name: this.normalizeCategoryName(rawName) || 'Categoria',
      description: this.toStringValue(this.pick(source, ['description', 'descripcion'])) || '',
      imageUrl: this.resolveAssetUrl(
        this.toStringValue(this.pick(source, ['imageUrl', 'image', 'imagePath'])),
      ),
      productIds: this.asNumberArray(this.pick(source, ['productIds'])),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
      updatedAt: this.toStringValue(this.pick(source, ['updateDate', 'updatedAt'])),
    };
  }

  private mapProd(input: unknown): AdminProduct {
    const source = this.asObject(input);
    const category = this.asObject(this.pick(source, ['category']));
    const rawCategoryName =
      this.toStringValue(this.pick(source, ['categoryName'])) ||
      this.toStringValue(this.pick(category, ['name']));

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      name: this.toStringValue(this.pick(source, ['name'])) || 'Producto',
      sku: this.toStringValue(this.pick(source, ['sku'])) || '',
      description: this.toStringValue(this.pick(source, ['description'])) || '',
      price: this.toNumber(this.pick(source, ['price', 'precio'])),
      stock: this.toNumber(this.pick(source, ['stock'])),
      categoryId:
        this.toNumber(this.pick(source, ['categoryId', 'category_id'])) ??
        this.toNumber(this.pick(category, ['id'])),
      categoryName: this.normalizeCategoryName(rawCategoryName) || 'Sin categoria',
      imageUrl: this.resolveAssetUrl(
        this.toStringValue(
          this.pick(source, ['imageUrl', 'image', 'imagePath', 'thumbnailUrl', 'thumbnail']),
        ),
      ),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
      updatedAt: this.toStringValue(this.pick(source, ['updateDate', 'updatedAt'])),
    };
  }

  private mapCust(input: unknown): AdminCustomer {
    const source = this.asObject(input);
    const roleRaw = (this.toStringValue(this.pick(source, ['role', 'rol'])) || 'USER').toUpperCase();
    const enabled = this.toBoolean(this.pick(source, ['enabled', 'isEnabled', 'active'])) ?? true;

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      email: this.toStringValue(this.pick(source, ['email'])) || '',
      firstName:
        this.toStringValue(this.pick(source, ['nombre', 'name', 'firstName', 'first_name'])) || '',
      lastName:
        this.toStringValue(this.pick(source, ['apellidos', 'lastName', 'last_name'])) || '',
      number: this.toNumber(this.pick(source, ['number', 'telefono', 'phone'])),
      role: roleRaw === 'ADMIN' ? 'admin' : 'user',
      status: this.normalizeUserStatus(null, enabled),
      enabled,
      addressIds: this.asNumberArray(this.pick(source, ['addressIds'])),
      orderIds: this.asNumberArray(this.pick(source, ['orderIds'])),
      cartId: this.toNumber(this.pick(source, ['cartId'])),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt'])),
      updatedAt: this.toStringValue(this.pick(source, ['updateDate', 'updatedAt'])),
    };
  }

  private mapOrd(input: unknown): AdminOrder {
    const source = this.asObject(input);
    const customer = this.asObject(this.pick(source, ['customer', 'cliente']));
    const customerId =
      this.toNumber(this.pick(source, ['customerId', 'customer_id'])) ??
      this.toNumber(this.pick(customer, ['id']));
    const items = this.asArray(this.pick(source, ['items', 'details', 'orderDetails', 'detalles'])).map(
      (item) => this.mapOrdItem(item),
    );
    const total =
      this.toNumber(this.pick(source, ['totalPrice', 'total', 'importeTotal', 'amount'])) ??
      items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
    const itemCount =
      this.toNumber(this.pick(source, ['totalAmount', 'itemCount', 'cantidadTotal'])) ??
      items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      customerId,
      customerEmail:
        this.toStringValue(this.pick(source, ['customerEmail'])) ||
        this.toStringValue(this.pick(customer, ['email'])) ||
        '',
      customerName:
        this.toStringValue(this.pick(source, ['customerName'])) ||
        this.buildFullName(
          this.toStringValue(this.pick(customer, ['nombre', 'name', 'firstName'])),
          this.toStringValue(this.pick(customer, ['apellidos', 'lastName'])),
        ) ||
        (customerId !== null ? `Cliente #${customerId}` : 'Cliente'),
      total,
      status: this.normalizeOrderStatus(
        this.toStringValue(this.pick(source, ['status', 'estado', 'orderStatus'])),
      ),
      createdAt: this.toStringValue(this.pick(source, ['createDate', 'createdAt', 'fecha'])),
      itemCount,
      addressId: this.toNumber(this.pick(source, ['addressId', 'address_id'])),
      orderDetailIds: this.asNumberArray(this.pick(source, ['orderDetailIds'])),
      items,
    };
  }

  private mapOrdItem(
    input: unknown,
    productsById: ReadonlyMap<number, AdminProduct> = new Map(),
  ): AdminOrderItem {
    const source = this.asObject(input);
    const product = this.asObject(this.pick(source, ['product', 'producto']));
    const productId =
      this.toNumber(this.pick(source, ['productId', 'product_id'])) ??
      this.toNumber(this.pick(product, ['id']));
    const quantity = this.toNumber(this.pick(source, ['quantity', 'cantidad'])) ?? 0;
    const priceUnit = this.toNumber(this.pick(source, ['priceUnit', 'price', 'precioUnitario']));
    const subtotal =
      this.toNumber(this.pick(source, ['subtotal', 'total'])) ??
      (priceUnit === null ? null : priceUnit * quantity);

    return {
      id: this.toNumber(this.pick(source, ['id'])) ?? 0,
      productId,
      productName:
        this.toStringValue(this.pick(source, ['productName', 'name'])) ||
        this.toStringValue(this.pick(product, ['name'])) ||
        (productId === null ? 'Producto' : productsById.get(productId)?.name || `Producto #${productId}`),
      quantity,
      priceUnit,
      subtotal,
    };
  }

  private normalizeUserStatus(value: string | null, enabled: boolean): UserStatus {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'inactive' || normalized === 'inactivo') {
      return 'inactive';
    }

    if (normalized === 'pending' || normalized === 'pendiente') {
      return 'pending';
    }

    return enabled ? 'active' : 'inactive';
  }

  private normalizeOrderStatus(value: string | null): OrderStatus {
    const normalized = value?.trim().toUpperCase();

    switch (normalized) {
      case 'SENT':
      case 'DELIVERED':
        return normalized;
      default:
        return 'CREATED';
    }
  }

  private buildFullName(firstName: string | null, lastName: string | null): string | null {
    const parts = [firstName?.trim(), lastName?.trim()].filter((value): value is string => !!value);

    return parts.length ? parts.join(' ') : null;
  }

  private normalizeCategoryName(value: string | null | undefined): string {
    const normalizedValue = value?.trim() || '';

    if (!normalizedValue) {
      return '';
    }

    const comparableValue = normalizedValue
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (comparableValue === 'accesorio') {
      return 'Accesorios';
    }

    if (comparableValue === 'ninos') {
      return 'Ni\u00F1os';
    }

    if (comparableValue === 'ninas') {
      return 'Ni\u00F1as';
    }

    return normalizedValue;
  }

  private resolveAssetUrl(assetPath: string | null): string | null {
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

  private toDateMs(value: string | null): number {
    if (!value) {
      return 0;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? 0 : timestamp;
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

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }

    return null;
  }
}
