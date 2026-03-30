import { type CatalogSubcategorySlug, type CategorySlug } from '../interfaces/catalog.interface';

export interface CategorySubcategoryOption {
  label: string;
  slug: CatalogSubcategorySlug;
}

export const CATEGORY_SUBCATEGORY_OPTIONS: readonly CategorySubcategoryOption[] = [
  { label: 'Ver todo', slug: 'all' },
  { label: 'Superiores', slug: 'superiores' },
  { label: 'Inferiores', slug: 'inferiores' },
  { label: 'Conjuntos', slug: 'conjuntos' },
  { label: 'Calzado', slug: 'calzado' },
];

type SubcategoryProductLike = {
  name: string;
  description: string;
  sku: string | null;
};

const SUBCATEGORY_KEYWORDS: Record<Exclude<CatalogSubcategorySlug, 'all'>, readonly string[]> = {
  superiores: [
    'americana',
    'abrigo',
    'blazer',
    'blusa',
    'body',
    'bodies',
    'camisa',
    'camiseta',
    'cardigan',
    'chaqueta',
    'cazadora',
    'chaleco',
    'coat',
    'hoodie',
    'jacket',
    'jersey',
    'polo',
    'parka',
    'shirt',
    'sudadera',
    'sueter',
    'sweater',
    'top',
  ],
  inferiores: [
    'bermuda',
    'cargo',
    'chino',
    'falda',
    'jean',
    'jeans',
    'jogger',
    'legging',
    'leggings',
    'pantalon',
    'short',
    'shorts',
    'skirt',
    'vaquero',
  ],
  conjuntos: [
    'conjunto',
    'coord',
    'jumpsuit',
    'look completo',
    'mono',
    'peto',
    'pijama',
    'romper',
    'set',
    'total look',
    'tracksuit',
    'vestido',
  ],
  calzado: [
    'alpargata',
    'bota',
    'botin',
    'boot',
    'calzado',
    'chancla',
    'heel',
    'loafer',
    'mocasin',
    'sandalia',
    'shoe',
    'sneaker',
    'tacon',
    'zapatilla',
    'zapato',
  ],
};

export function supportsCategorySubcategories(categorySlug: CategorySlug | null): boolean {
  return !!categorySlug && categorySlug !== 'accessories';
}

export function normalizeCategorySubcategory(
  value: string | null | undefined,
): CatalogSubcategorySlug {
  const normalizedValue = normalizeText(value);

  switch (normalizedValue) {
    case 'superiores':
      return 'superiores';
    case 'inferiores':
      return 'inferiores';
    case 'conjuntos':
      return 'conjuntos';
    case 'calzado':
      return 'calzado';
    default:
      return 'all';
  }
}

export function buildSubcategoryQueryParams(
  subcategory: CatalogSubcategorySlug,
): Record<string, string> {
  if (subcategory === 'all') {
    return {};
  }

  return { subcategoria: subcategory };
}

export function filterProductsBySubcategory<T extends SubcategoryProductLike>(
  products: readonly T[],
  subcategory: CatalogSubcategorySlug,
): readonly T[] {
  if (subcategory === 'all') {
    return products;
  }

  return products.filter((product) => resolveProductSubcategory(product) === subcategory);
}

export function resolveProductSubcategory(
  product: SubcategoryProductLike,
): CatalogSubcategorySlug {
  const searchableText = normalizeText([product.name, product.description, product.sku].join(' '));

  if (!searchableText) {
    return 'superiores';
  }

  for (const subcategory of ['calzado', 'conjuntos', 'inferiores', 'superiores'] as const) {
    if (SUBCATEGORY_KEYWORDS[subcategory].some((keyword) => searchableText.includes(keyword))) {
      return subcategory;
    }
  }

  return 'superiores';
}

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
