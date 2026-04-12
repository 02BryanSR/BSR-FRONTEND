import { Routes } from '@angular/router';
import { adminChildGuard, adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/register/register').then((m) => m.Register),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'home',
    loadComponent: () => import('./features/main/main').then((m) => m.Main),
  },
  {
    path: 'women',
    loadComponent: () => import('./features/women/women').then((m) => m.Women),
  },
  {
    path: 'men',
    loadComponent: () => import('./features/men/men').then((m) => m.Men),
  },
  {
    path: 'boys',
    loadComponent: () => import('./features/boys/boys').then((m) => m.Boys),
  },
  {
    path: 'girls',
    loadComponent: () => import('./features/girls/girls').then((m) => m.Girls),
  },
  {
    path: 'accessories',
    loadComponent: () =>
      import('./features/accessories/accessories').then((m) => m.Accessories),
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('./features/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: 'product/:id',
    redirectTo: 'products/:id',
    pathMatch: 'full',
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cart/cart').then((m) => m.Cart),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
  },
  {
    path: 'my-addresses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/my-addresses/my-addresses').then((m) => m.MyAddresses),
  },
  {
    path: 'my-orders',
    canActivate: [authGuard],
    loadComponent: () => import('./features/my-orders/my-orders').then((m) => m.MyOrders),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () => import('./features/favorites/favorites').then((m) => m.Favorites),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    canActivateChild: [adminChildGuard],
    loadComponent: () => import('./features/admin/layout/layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/admin/products/products').then((m) => m.AdminProducts),
      },
      {
        path: 'categories/:categoryId/subcategories/:subcategorySlug/products',
        loadComponent: () =>
          import('./features/admin/subcategory-products/subcategory-products').then(
            (m) => m.AdminSubcategoryProducts,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/admin/categories/categories').then((m) => m.AdminCategories),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/admin/customers/customers').then((m) => m.AdminCustomers),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/admin/orders/orders').then((m) => m.AdminOrders),
      },
    ],
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
