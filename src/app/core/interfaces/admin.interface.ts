import { UserRole, UserStatus } from './user.interface';

export type OrderStatus =
  | 'CREATED'
  | 'SENT'
  | 'DELIVERED';

export interface AdminCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  productIds: readonly number[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminCategoryInput {
  name: string;
  description: string;
  imageUrl: string | null;
  imageFile: File | null;
  removeImage?: boolean;
}

export interface AdminProduct {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number | null;
  stock: number | null;
  categoryId: number | null;
  categoryName: string;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminProductInput {
  name: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  categoryId: number;
  imageUrl: string | null;
  imageFile: File | null;
  removeImage?: boolean;
}

export interface AdminSubcategory {
  categoryId: number;
  slug: string;
  label: string;
  createdAt: string | null;
}

export interface AdminCustomer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  number: number | null;
  role: UserRole;
  status: UserStatus;
  enabled: boolean;
  addressIds: readonly number[];
  orderIds: readonly number[];
  cartId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminCustomerInput {
  email: string;
  firstName: string;
  lastName: string;
  number: number | null;
  role: UserRole;
  enabled: boolean;
  password: string | null;
}

export interface AdminOrderItem {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  priceUnit: number | null;
  subtotal: number | null;
}

export interface AdminOrder {
  id: number;
  customerId: number | null;
  customerEmail: string;
  customerName: string;
  total: number | null;
  status: OrderStatus;
  createdAt: string | null;
  itemCount: number;
  addressId: number | null;
  orderDetailIds: readonly number[];
  items: readonly AdminOrderItem[];
}

export interface AdminDashboardData {
  productCount: number;
  categoryCount: number;
  customerCount: number;
  orderCount: number;
  salesToday: number;
  salesMonth: number;
  salesPreviousMonth: number;
  salesMonthDelta: number;
  adminCount: number;
  activeCustomerCount: number;
  pendingOrderCount: number;
  lowStockCount: number;
  revenueTotal: number;
  recentProducts: readonly AdminProduct[];
  recentOrders: readonly AdminOrder[];
}
