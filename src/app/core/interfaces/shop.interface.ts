export type UserOrderStatus = 'CREATED' | 'SENT' | 'DELIVERED';

export interface UserCartItem {
  id: number;
  productId: number;
  productName: string;
  size: string | null;
  price: number | null;
  quantity: number;
  subtotal: number | null;
}

export interface UserCart {
  cartId: number | null;
  customerId: number | null;
  total: number;
  totalProducts: number;
  items: readonly UserCartItem[];
}

export interface UserAddress {
  id: number;
  address: string;
  city: string;
  country: string;
  cp: string;
  state: string;
  customerId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserAddressInput {
  address: string;
  city: string;
  country: string;
  cp: string;
  state: string;
}

export interface UserOrder {
  id: number;
  status: UserOrderStatus;
  totalAmount: number;
  totalPrice: number;
  payMethod: string;
  customerId: number | null;
  addressId: number | null;
  orderDetailIds: readonly number[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserOrderDetail {
  id: number;
  quantity: number;
  priceUnit: number | null;
  productId: number | null;
  orderId: number | null;
  size: string | null;
  subtotal: number | null;
}

export interface UserFavorite {
  id: number;
  customerId: number | null;
  productId: number;
  productName: string;
  productSku: string | null;
  productImageUrl: string | null;
  productPrice: number | null;
  productStock: number | null;
  createdAt: string | null;
}

export interface CreateOrderInput {
  addressId: number;
  payMethod: string;
}

export interface CreatePaymentIntentInput {
  addressId: number;
  payMethod: string;
}

export interface CheckoutPaymentIntent {
  clientSecret: string;
  paymentIntentId: string | null;
  amount: number | null;
  currency: string;
}

export interface ConfirmPaymentInput {
  paymentIntentId: string;
}

export interface OrderInvoiceFile {
  blob: Blob;
  fileName: string;
}
