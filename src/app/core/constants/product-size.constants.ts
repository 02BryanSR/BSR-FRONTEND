import { resolveProductSubcategory } from './category-subcategories.constants';
import { CatalogCategory, CatalogProduct, CategorySlug } from '../interfaces/catalog.interface';

const ADULT_APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
const KIDS_APPAREL_SIZES = ['4', '6', '9', '10', '12', '14', '16'] as const;
const ADULT_SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'] as const;
const KIDS_SHOE_SIZES = ['28', '30', '32', '34', '36', '38'] as const;

const SIZE_OPTIONS_BY_CATEGORY: Partial<Record<CategorySlug, readonly string[]>> = {
  women: ADULT_APPAREL_SIZES,
  men: ADULT_APPAREL_SIZES,
  boys: KIDS_APPAREL_SIZES,
  girls: KIDS_APPAREL_SIZES,
};

const SHOE_SIZE_OPTIONS_BY_CATEGORY: Partial<Record<CategorySlug, readonly string[]>> = {
  women: ADULT_SHOE_SIZES,
  men: ADULT_SHOE_SIZES,
  boys: KIDS_SHOE_SIZES,
  girls: KIDS_SHOE_SIZES,
};

export function resolveAvailableProductSizes(
  product: CatalogProduct | null,
  categories: readonly CatalogCategory[],
): readonly string[] {
  if (!product) {
    return [];
  }

  const categorySlug = categories.find((category) => category.id === product.categoryId)?.slug;

  if (!categorySlug) {
    return [];
  }

  if (resolveProductSubcategory(product) === 'calzado') {
    return SHOE_SIZE_OPTIONS_BY_CATEGORY[categorySlug] ?? [];
  }

  return SIZE_OPTIONS_BY_CATEGORY[categorySlug] ?? [];
}
