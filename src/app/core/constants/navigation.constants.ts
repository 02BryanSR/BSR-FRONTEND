import { type CategorySlug } from '../interfaces/catalog.interface';

export interface NavigationLink {
  label: string;
  route: string;
  categorySlug: CategorySlug | null;
}

export const PRIMARY_NAV_LINKS: readonly NavigationLink[] = [
  { label: 'INICIO', route: '/home', categorySlug: null },
  { label: 'MUJER', route: '/women', categorySlug: 'women' },
  { label: 'HOMBRE', route: '/men', categorySlug: 'men' },
  { label: 'NI\u00D1OS', route: '/boys', categorySlug: 'boys' },
  { label: 'NI\u00D1AS', route: '/girls', categorySlug: 'girls' },
  { label: 'ACCESORIOS', route: '/accessories', categorySlug: 'accessories' },
];

export const HIDDEN_LAYOUT_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;
