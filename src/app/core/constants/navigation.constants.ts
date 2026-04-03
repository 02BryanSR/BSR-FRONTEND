import { type CategorySlug } from '../interfaces/catalog.interface';

export interface NavigationLink {
  label: string;
  route: string;
  categorySlug: CategorySlug | null;
}

export const PRIMARY_NAV_LINKS: readonly NavigationLink[] = [
  { label: 'HOME', route: '/home', categorySlug: null },
  { label: 'WOMEN', route: '/women', categorySlug: 'women' },
  { label: 'MEN', route: '/men', categorySlug: 'men' },
  { label: 'NI\u00D1OS', route: '/ninos', categorySlug: 'boys' },
  { label: 'NI\u00D1AS', route: '/ninas', categorySlug: 'girls' },
  { label: 'ACCESSORIES', route: '/accessories', categorySlug: 'accessories' },
];

export const HIDDEN_LAYOUT_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;
