import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AdminCategory, AdminProduct } from '../../../core/interfaces/admin.interface';
import { AdminSubcategoryStoreService } from '../../../core/services/admin-subcategory-store.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminProductManager } from '../components/product-manager/product-manager';

@Component({
  selector: 'app-admin-subcategory-products',
  standalone: true,
  imports: [RouterLink, AdminProductManager],
  templateUrl: './subcategory-products.html',
})
export class AdminSubcategoryProducts {
  private readonly adminService = inject(AdminService);
  private readonly subcategoryStore = inject(AdminSubcategoryStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  readonly categories = signal<readonly AdminCategory[]>([]);
  readonly products = signal<readonly AdminProduct[]>([]);
  readonly loading = signal(true);
  readonly categoryId = signal<number | null>(null);
  readonly subcategorySlug = signal<string | null>(null);
  readonly selectedCategory = computed(
    () => this.categories().find((category) => category.id === this.categoryId()) ?? null,
  );
  readonly selectedSubcategory = computed(() => {
    const categoryId = this.categoryId();
    const subcategorySlug = this.subcategorySlug();

    if (categoryId === null || subcategorySlug === null) {
      return null;
    }

    return this.subcategoryStore.getSubcategory(
      categoryId,
      subcategorySlug,
      this.categories(),
      this.products(),
    );
  });
  readonly productCount = computed(() => {
    const categoryId = this.categoryId();
    const subcategorySlug = this.subcategorySlug();

    if (categoryId === null || subcategorySlug === null) {
      return 0;
    }

    return this.products().filter(
      (product) =>
        product.categoryId === categoryId &&
        this.subcategoryStore.getAssignedSubcategorySlug(
          product.id,
          product.categoryId,
          this.categories(),
          this.products(),
        ) === subcategorySlug,
    ).length;
  });

  constructor() {
    this.route.paramMap.subscribe((paramMap) => {
      const categoryId = Number(paramMap.get('categoryId'));
      const subcategorySlug = paramMap.get('subcategorySlug');

      this.categoryId.set(Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null);
      this.subcategorySlug.set(subcategorySlug?.trim() || null);
      this.loadData();
    });
  }

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      categories: this.adminService.getCategories(),
      products: this.adminService.getProducts(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ categories, products }) => {
          this.categories.set(categories);
          this.products.set(products);
        },
        error: () => {
          this.categories.set([]);
          this.products.set([]);
          this.toastService.showError('No se pudieron cargar los productos de la subcategoría.');
        },
      });
  }
}
