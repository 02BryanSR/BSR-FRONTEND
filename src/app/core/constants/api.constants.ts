declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080';

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  const configuredBaseUrl = window.__APP_CONFIG__?.apiBaseUrl?.trim();

  if (!configuredBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  return configuredBaseUrl.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

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
    favoriteExists: (productId: number | string) =>
      `${API_BASE_URL}/api/favorites/me/${productId}/exists`,
    addresses: `${API_BASE_URL}/api/addresses/me`,
    address: (id: number | string) => `${API_BASE_URL}/api/addresses/me/${id}`,
    orders: `${API_BASE_URL}/api/orders/me`,
    order: (id: number | string) => `${API_BASE_URL}/api/orders/me/${id}`,
    orderDetails: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/details`,
  },
  admin: {
    products: `${API_BASE_URL}/api/products`,
    product: (id: number | string) => `${API_BASE_URL}/api/products/${id}`,
    categories: `${API_BASE_URL}/api/categories`,
    category: (id: number | string) => `${API_BASE_URL}/api/categories/${id}`,
    customers: `${API_BASE_URL}/api/customers`,
    customer: (id: number | string) => `${API_BASE_URL}/api/customers/${id}`,
    orders: `${API_BASE_URL}/api/orders`,
    order: (id: number | string) => `${API_BASE_URL}/api/orders/${id}`,
    orderDetails: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/details/admin`,
    orderStatus: (id: number | string) => `${API_BASE_URL}/api/orders/${id}/status`,
  },
};
