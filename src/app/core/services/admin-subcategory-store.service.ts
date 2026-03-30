import { Injectable } from '@angular/core';
import {
  CATEGORY_SUBCATEGORY_OPTIONS,
  filterProductsBySubcategory,
  supportsCategorySubcategories,
} from '../constants/category-subcategories.constants';
import { type CatalogSubcategorySlug, type CategorySlug } from '../interfaces/catalog.interface';
import { AdminCategory, AdminProduct, AdminSubcategory } from '../interfaces/admin.interface';

const SUBCATEGORY_STORAGE_KEY = 'bsr.admin.subcategories.v1';
const PRODUCT_SUBCATEGORY_STORAGE_KEY = 'bsr.admin.product-subcategories.v1';

const CATEGORY_ALIASES: Record<CategorySlug, readonly string[]> = {
  women: ['women', 'woman', 'mujer', 'mujeres'],
  men: ['men', 'man', 'hombre', 'hombres'],
  boys: ['boys', 'boy', 'nino', 'ninos', 'niños'],
  girls: ['girls', 'girl', 'nina', 'ninas', 'niñas'],
  kids: ['kids', 'kid', 'children', 'child', 'infantil'],
  accessories: ['accessories', 'accessory', 'accesorio', 'accesorios'],
};

type StoredAssignments = Record<string, string>;

@Injectable({
  providedIn: 'root',
})
export class AdminSubcategoryStoreService {
  listSubcategories(
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): readonly AdminSubcategory[] {
    return this.ensureBootstrapped(categories, products);
  }

  listByCategory(
    categoryId: number,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): readonly AdminSubcategory[] {
    return this.listSubcategories(categories, products).filter(
      (subcategory) => subcategory.categoryId === categoryId,
    );
  }

  getSubcategory(
    categoryId: number,
    slug: string,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): AdminSubcategory | null {
    const normalizedSlug = this.normalizeSlug(slug);

    return (
      this.listByCategory(categoryId, categories, products).find(
        (subcategory) => subcategory.slug === normalizedSlug,
      ) ?? null
    );
  }

  getAssignments(
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): Readonly<Record<number, string>> {
    const subcategories = this.ensureBootstrapped(categories, products);
    const validAssignments = new Set(
      subcategories.map((subcategory) => this.buildAssignmentValue(subcategory.categoryId, subcategory.slug)),
    );
    const rawAssignments = this.readAssignments();
    const assignments: Record<number, string> = {};
    let hasChanges = false;

    for (const product of products) {
      const rawValue = rawAssignments[String(product.id)];

      if (!rawValue || !validAssignments.has(rawValue)) {
        hasChanges = hasChanges || !!rawValue;
        continue;
      }

      assignments[product.id] = rawValue;
    }

    if (hasChanges || Object.keys(assignments).length !== Object.keys(rawAssignments).length) {
      this.writeAssignments(
        Object.fromEntries(Object.entries(assignments).map(([productId, value]) => [productId, value])),
      );
    }

    return assignments;
  }

  getAssignedSubcategorySlug(
    productId: number,
    categoryId: number | null,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): string | null {
    if (categoryId === null) {
      return null;
    }

    const assignment = this.getAssignments(categories, products)[productId];

    if (!assignment) {
      return null;
    }

    const { categoryId: assignedCategoryId, slug } = this.parseAssignmentValue(assignment);
    return assignedCategoryId === categoryId ? slug : null;
  }

  createSubcategory(
    categoryId: number,
    label: string,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): AdminSubcategory {
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      throw new Error('La subcategoría necesita un nombre.');
    }

    const subcategories = [...this.ensureBootstrapped(categories, products)];
    const existingByCategory = subcategories.filter((subcategory) => subcategory.categoryId === categoryId);
    const baseSlug = this.normalizeSlug(trimmedLabel) || 'subcategoria';
    let nextSlug = baseSlug;
    let suffix = 2;

    while (existingByCategory.some((subcategory) => subcategory.slug === nextSlug)) {
      nextSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const nextSubcategory: AdminSubcategory = {
      categoryId,
      slug: nextSlug,
      label: trimmedLabel,
      createdAt: new Date().toISOString(),
    };

    subcategories.push(nextSubcategory);
    this.writeSubcategories(subcategories);

    return nextSubcategory;
  }

  deleteSubcategory(
    categoryId: number,
    slug: string,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): void {
    const normalizedSlug = this.normalizeSlug(slug);
    const subcategories = this.ensureBootstrapped(categories, products);
    const nextSubcategories = subcategories.filter(
      (subcategory) =>
        !(subcategory.categoryId === categoryId && subcategory.slug === normalizedSlug),
    );

    if (nextSubcategories.length === subcategories.length) {
      throw new Error('La subcategoría ya no existe o no se pudo localizar.');
    }

    this.writeSubcategories(nextSubcategories);

    const assignmentValue = this.buildAssignmentValue(categoryId, normalizedSlug);
    const nextAssignments = Object.fromEntries(
      Object.entries(this.readAssignments()).filter(([, value]) => value !== assignmentValue),
    );

    this.writeAssignments(nextAssignments);
  }

  saveProductAssignment(
    productId: number,
    categoryId: number | null,
    subcategorySlug: string | null,
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[] = [],
  ): void {
    const assignments = { ...this.readAssignments() };

    if (categoryId === null || !subcategorySlug) {
      delete assignments[String(productId)];
      this.writeAssignments(assignments);
      return;
    }

    const normalizedSlug = this.normalizeSlug(subcategorySlug);
    const subcategory = this.getSubcategory(categoryId, normalizedSlug, categories, products);

    if (!subcategory) {
      delete assignments[String(productId)];
      this.writeAssignments(assignments);
      return;
    }

    assignments[String(productId)] = this.buildAssignmentValue(categoryId, normalizedSlug);
    this.writeAssignments(assignments);
  }

  removeProductAssignment(productId: number): void {
    const assignments = { ...this.readAssignments() };

    if (!(String(productId) in assignments)) {
      return;
    }

    delete assignments[String(productId)];
    this.writeAssignments(assignments);
  }

  private ensureBootstrapped(
    categories: readonly AdminCategory[],
    products: readonly AdminProduct[],
  ): readonly AdminSubcategory[] {
    const validCategoryIds = new Set(categories.map((category) => category.id));
    const currentSubcategories = this.readSubcategories().filter((subcategory) =>
      validCategoryIds.has(subcategory.categoryId),
    );
    const nextSubcategories = [...currentSubcategories];
    let subcategoriesChanged = currentSubcategories.length !== this.readSubcategories().length;

    for (const category of categories) {
      const categorySubcategories = nextSubcategories.filter(
        (subcategory) => subcategory.categoryId === category.id,
      );

      if (categorySubcategories.length) {
        continue;
      }

      const defaults = this.buildDefaultSubcategories(category);

      if (defaults.length) {
        nextSubcategories.push(...defaults);
        subcategoriesChanged = true;
      }
    }

    if (subcategoriesChanged) {
      this.writeSubcategories(nextSubcategories);
    }

    const validAssignments = new Set(
      nextSubcategories.map((subcategory) =>
        this.buildAssignmentValue(subcategory.categoryId, subcategory.slug),
      ),
    );
    const currentAssignments = this.readAssignments();
    const nextAssignments: StoredAssignments = {};
    let assignmentsChanged = false;

    for (const product of products) {
      const productKey = String(product.id);
      const existingAssignment = currentAssignments[productKey];

      if (existingAssignment && validAssignments.has(existingAssignment)) {
        nextAssignments[productKey] = existingAssignment;
        continue;
      }

      const inferredAssignment = this.inferAssignmentValue(product, nextSubcategories);

      if (inferredAssignment) {
        nextAssignments[productKey] = inferredAssignment;
      }

      if (existingAssignment !== inferredAssignment) {
        assignmentsChanged = true;
      }
    }

    if (
      assignmentsChanged ||
      Object.keys(nextAssignments).length !== Object.keys(currentAssignments).length
    ) {
      this.writeAssignments(nextAssignments);
    }

    return nextSubcategories;
  }

  private buildDefaultSubcategories(category: AdminCategory): readonly AdminSubcategory[] {
    const categorySlug = this.resolveCategorySlug(category.name);

    if (!supportsCategorySubcategories(categorySlug)) {
      return [];
    }

    return CATEGORY_SUBCATEGORY_OPTIONS.filter((subcategory) => subcategory.slug !== 'all').map(
      (subcategory) => ({
        categoryId: category.id,
        slug: subcategory.slug,
        label: subcategory.label,
        createdAt: null,
      }),
    );
  }

  private inferAssignmentValue(
    product: AdminProduct,
    subcategories: readonly AdminSubcategory[],
  ): string | null {
    if (product.categoryId === null) {
      return null;
    }

    const categorySubcategories = subcategories.filter(
      (subcategory) => subcategory.categoryId === product.categoryId,
    );
    const defaultSubcategories = categorySubcategories.filter((subcategory) =>
      ['superiores', 'inferiores', 'conjuntos', 'calzado'].includes(subcategory.slug),
    );

    for (const subcategory of defaultSubcategories) {
      const defaultSlug = subcategory.slug as Exclude<CatalogSubcategorySlug, 'all'>;

      if (filterProductsBySubcategory([product], defaultSlug).length) {
        return this.buildAssignmentValue(product.categoryId, subcategory.slug);
      }
    }

    return null;
  }

  private resolveCategorySlug(categoryName: string | null): CategorySlug | null {
    const normalizedName = (categoryName ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalizedName) {
      return null;
    }

    for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES) as [
      CategorySlug,
      readonly string[],
    ][]) {
      if (aliases.some((alias) => normalizedName === alias || normalizedName.includes(alias))) {
        return slug;
      }
    }

    return null;
  }

  private buildAssignmentValue(categoryId: number, slug: string): string {
    return `${categoryId}:${slug}`;
  }

  private parseAssignmentValue(value: string): { categoryId: number | null; slug: string | null } {
    const [rawCategoryId, rawSlug] = value.split(':', 2);
    const categoryId = Number(rawCategoryId);
    return {
      categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
      slug: rawSlug?.trim() || null,
    };
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private readSubcategories(): readonly AdminSubcategory[] {
    const storage = this.storage;

    if (!storage) {
      return [];
    }

    try {
      const rawValue = storage.getItem(SUBCATEGORY_STORAGE_KEY);

      if (!rawValue) {
        return [];
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!Array.isArray(parsedValue)) {
        return [];
      }

      return parsedValue.flatMap((item) => {
        const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;

        if (!source) {
          return [];
        }

        const categoryId = Number(source['categoryId']);
        const slug = typeof source['slug'] === 'string' ? this.normalizeSlug(source['slug']) : '';
        const label = typeof source['label'] === 'string' ? source['label'].trim() : '';

        if (!Number.isInteger(categoryId) || categoryId <= 0 || !slug || !label) {
          return [];
        }

        return [
          {
            categoryId,
            slug,
            label,
            createdAt: typeof source['createdAt'] === 'string' ? source['createdAt'] : null,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  private writeSubcategories(subcategories: readonly AdminSubcategory[]): void {
    const storage = this.storage;

    if (!storage) {
      return;
    }

    try {
      storage.setItem(SUBCATEGORY_STORAGE_KEY, JSON.stringify(subcategories));
    } catch {}
  }

  private readAssignments(): StoredAssignments {
    const storage = this.storage;

    if (!storage) {
      return {};
    }

    try {
      const rawValue = storage.getItem(PRODUCT_SUBCATEGORY_STORAGE_KEY);

      if (!rawValue) {
        return {};
      }

      const parsedValue = JSON.parse(rawValue) as unknown;
      return parsedValue && typeof parsedValue === 'object'
        ? (parsedValue as StoredAssignments)
        : {};
    } catch {
      return {};
    }
  }

  private writeAssignments(assignments: StoredAssignments): void {
    const storage = this.storage;

    if (!storage) {
      return;
    }

    try {
      storage.setItem(PRODUCT_SUBCATEGORY_STORAGE_KEY, JSON.stringify(assignments));
    } catch {}
  }

  private get storage(): Storage | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage;
  }
}
