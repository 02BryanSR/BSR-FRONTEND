import { environment } from '../../../environments/environment';

function normalizeValue(value: string): string {
  return value.trim();
}

function normalizeBaseUrl(baseUrl: string): string {
  return normalizeValue(baseUrl).replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(environment.apiBaseUrl);
export const STRIPE_PUBLISHABLE_KEY = normalizeValue(environment.stripe.publishableKey);
export const CARD_CHECKOUT_MODE = environment.stripe.checkoutMode;
export const ADDRESS_LOOKUP_API_KEY = normalizeValue(environment.geoapify.apiKey);
export const ADDRESS_LOOKUP_REGION = normalizeValue(environment.geoapify.region);
export const ADDRESS_LOOKUP_LANGUAGE = normalizeValue(environment.geoapify.language);

export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    forgotPassword: `${API_BASE_URL}/api/auth/forgot-password`,
    resetPassword: `${API_BASE_URL}/api/auth/reset-password`,
    me: `${API_BASE_URL}/api/auth/me`,
  },
  catalog: {
    categories: `${API_BASE_URL}/api/categories`,
    product: (id: number | string) => `${API_BASE_URL}/api/products/${id}`,
    productsByCategory: (categoryId: number | string) =>
      `${API_BASE_URL}/api/products/category/${categoryId}`,
  },
  shop: {
    cart: `${API_BASE_URL}/api/cart/me`,
    cartItems: `${API_BASE_URL}/api/cart/me/items`,
    cartItem: (productId: number | string) => `${API_BASE_URL}/api/cart/me/items/${productId}`,
    favorites: `${API_BASE_URL}/api/favorites/me`,
    favorite: (productId: number | string) => `${API_BASE_URL}/api/favorites/me/${productId}`,
    addresses: `${API_BASE_URL}/api/addresses/me`,
    address: (id: number | string) => `${API_BASE_URL}/api/addresses/me/${id}`,
    orders: `${API_BASE_URL}/api/orders/me`,
    orderInvoice: (id: number | string) => `${API_BASE_URL}/api/orders/me/${id}/invoice`,
    orderDetails: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/details`,
    paymentIntent: `${API_BASE_URL}/api/payments/intent`,
    confirmPayment: `${API_BASE_URL}/api/payments/confirm`,
  },
  admin: {
    products: `${API_BASE_URL}/api/products`,
    product: (id: number | string) => `${API_BASE_URL}/api/products/${id}`,
    categories: `${API_BASE_URL}/api/categories`,
    category: (id: number | string) => `${API_BASE_URL}/api/categories/${id}`,
    customers: `${API_BASE_URL}/api/customers`,
    customer: (id: number | string) => `${API_BASE_URL}/api/customers/${id}`,
    orders: `${API_BASE_URL}/api/orders`,
    orderDetails: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/details/admin`,
    orderStatus: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/status`,
  },
};
