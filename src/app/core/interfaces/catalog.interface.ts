export type CategorySlug = 'women' | 'men' | 'boys' | 'girls' | 'accessories';
export type CatalogSubcategorySlug = 'all' | 'superiores' | 'inferiores' | 'conjuntos' | 'calzado';

export interface CategoryApiResponse {
  id: number;
  name: string;
  description: string;
  imageUrl?: string | null;
  productIds: number[];
}

export interface ProductApiResponse {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  categoryId: number;
  imageUrl?: string | null;
  image?: string | null;
  imagePath?: string | null;
  thumbnailUrl?: string | null;
}

export interface CatalogCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  productIds: readonly number[];
  slug: CategorySlug;
  route: string;
}

export interface CatalogProduct {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  categoryId: number;
  imageUrl: string | null;
}

export type CatalogSearchItemType = 'category' | 'product' | 'page';

export interface CatalogSearchItem {
  type: CatalogSearchItemType;
  id: number;
  title: string;
  subtitle: string;
  route: string;
  imageUrl: string | null;
  keywords: readonly string[];
}
