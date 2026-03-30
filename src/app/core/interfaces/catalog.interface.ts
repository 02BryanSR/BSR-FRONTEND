export type CategorySlug = 'women' | 'men' | 'boys' | 'girls' | 'kids' | 'accessories';
export type CatalogSubcategorySlug = 'all' | 'superiores' | 'inferiores' | 'conjuntos' | 'calzado';

export interface CategoryApiResponse {
  id: number;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  productIds?: number[] | null;
}

export interface ProductApiResponse {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;
  price: number | null;
  stock: number | null;
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
  slug: CategorySlug | null;
  route: string | null;
}

export interface CatalogProduct {
  id: number;
  name: string;
  sku: string | null;
  description: string;
  price: number | null;
  stock: number | null;
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
