import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import {
  AdminCategory,
  AdminCategoryInput,
  AdminProduct,
  AdminSubcategory,
} from '../../../core/interfaces/admin.interface';
import { AdminSubcategoryStoreService } from '../../../core/services/admin-subcategory-store.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

interface AdminCategoryCatalogGroup {
  category: AdminCategory;
  products: readonly AdminProduct[];
  subcategories: readonly (AdminSubcategory & { productCount: number })[];
}

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categories.html',
})
export class AdminCategories implements OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly subcategoryStore = inject(AdminSubcategoryStoreService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  @ViewChild('editorPanel') private editorPanel?: ElementRef<HTMLElement>;
  @ViewChild('subcategoryPanel') private subcategoryPanel?: ElementRef<HTMLElement>;
  private objectUrl: string | null = null;

  readonly categories = signal<readonly AdminCategory[]>([]);
  readonly products = signal<readonly AdminProduct[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedCategoryId = signal<number | null>(null);
  readonly selectedCatalogCategoryId = signal<number | null>(null);
  readonly subcategoryVersion = signal(0);
  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly isEditing = computed(() => this.selectedCategoryId() !== null);
  readonly catalogGroups = computed<readonly AdminCategoryCatalogGroup[]>(() => {
    this.subcategoryVersion();
    const categories = this.categories();
    const products = this.products();

    return categories.map((category) => {
      const categoryProducts = products.filter((product) => product.categoryId === category.id);
      const subcategories = this.subcategoryStore
        .listByCategory(category.id, categories, products)
        .map((subcategory) => ({
          ...subcategory,
          productCount: categoryProducts.filter(
            (product) =>
              this.subcategoryStore.getAssignedSubcategorySlug(
                product.id,
                product.categoryId,
                categories,
                products,
              ) === subcategory.slug,
          ).length,
        }));

      return {
        category,
        products: categoryProducts,
        subcategories,
      };
    });
  });
  readonly selectedCatalogGroup = computed<AdminCategoryCatalogGroup | null>(() => {
    const selectedCatalogCategoryId = this.selectedCatalogCategoryId();
    const groups = this.catalogGroups();

    if (!groups.length) {
      return null;
    }

    if (selectedCatalogCategoryId === null) {
      return groups[0];
    }

    return groups.find((group) => group.category.id === selectedCatalogCategoryId) ?? groups[0];
  });

  readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    imageUrl: [''],
  });

  readonly subcategoryForm = this.formBuilder.group({
    label: ['', [Validators.required, Validators.maxLength(80)]],
  });

  constructor() {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.releaseObjectUrl();
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
          this.syncSelectedCatalogCategory(categories);
          this.bumpSubcategoryVersion();
        },
        error: () => {
          this.categories.set([]);
          this.products.set([]);
          this.toastService.showError('No se pudieron cargar las categorías del catálogo.');
        },
      });
  }

  startCreate(): void {
    this.selectedCategoryId.set(null);
    this.imageFile.set(null);
    this.setPreview(null);
    this.form.reset({
      name: '',
      description: '',
      imageUrl: '',
    });
  }

  startEdit(category: AdminCategory): void {
    this.selectedCategoryId.set(category.id);
    this.selectedCatalogCategoryId.set(category.id);
    this.imageFile.set(null);
    this.form.reset({
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl ?? '',
    });
    this.setPreview(category.imageUrl);
    this.scrollEditorIntoView();
  }

  selectCatalogCategory(categoryId: number): void {
    this.selectedCatalogCategoryId.set(categoryId);
    this.scrollSubcategoryPanelIntoView();
  }

  openSubcategoryProducts(categoryId: number, subcategorySlug: string): void {
    void this.router.navigate([
      '/admin/categories',
      categoryId,
      'subcategories',
      subcategorySlug,
      'products',
    ]);
  }

  createSubcategory(): void {
    if (this.subcategoryForm.invalid) {
      this.subcategoryForm.markAllAsTouched();
      this.toastService.showFormValidationError();
      return;
    }

    const categoryId = this.selectedCatalogCategoryId();

    if (categoryId === null) {
      this.toastService.showError('Selecciona una categoría antes de crear una subcategoría.');
      return;
    }

    const label = this.subcategoryForm.controls.label.value?.trim() || '';

    try {
      const createdSubcategory = this.subcategoryStore.createSubcategory(
        categoryId,
        label,
        this.categories(),
        this.products(),
      );

      this.subcategoryForm.reset({ label: '' });
      this.bumpSubcategoryVersion();
      this.toastService.show({
        title: 'Subcategoría creada',
        message: `${createdSubcategory.label} ya está disponible en esta categoría.`,
      });
    } catch (error) {
      this.toastService.showError(
        error instanceof Error ? error.message : 'No se pudo crear la subcategoría.',
      );
    }
  }

  deleteSubcategory(subcategory: AdminSubcategory): void {
    const confirmed = window.confirm(
      `¿Quieres eliminar la subcategoría "${subcategory.label}"? Los productos quedarán sin subcategoría asignada.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      this.subcategoryStore.deleteSubcategory(
        subcategory.categoryId,
        subcategory.slug,
        this.categories(),
        this.products(),
      );

      this.bumpSubcategoryVersion();
      this.toastService.show({
        title: 'Subcategoría eliminada',
        message: `${subcategory.label} se ha eliminado correctamente.`,
      });
    } catch (error) {
      this.toastService.showError(
        error instanceof Error ? error.message : 'No se pudo eliminar la subcategoría.',
      );
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.showFormValidationError();
      return;
    }

    const rawValue = this.form.getRawValue();
    const selectedCategoryId = this.selectedCategoryId();
    const selectedCategory =
      selectedCategoryId === null
        ? null
        : this.categories().find((category) => category.id === selectedCategoryId) ?? null;
    const normalizedImageUrl = rawValue.imageUrl?.trim() || '';
    const removeImage =
      selectedCategory !== null &&
      !!selectedCategory.imageUrl &&
      !this.imageFile() &&
      !normalizedImageUrl;
    const payload: AdminCategoryInput = {
      name: rawValue.name?.trim() || '',
      description: rawValue.description?.trim() || '',
      imageUrl: normalizedImageUrl || null,
      imageFile: this.imageFile(),
      removeImage,
    };

    const request$ =
      selectedCategoryId === null
        ? this.adminService.createCategory(payload)
        : this.adminService.updateCategory(selectedCategoryId, payload);

    this.saving.set(true);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (category) => {
        this.applyStoredImageUrl(category.imageUrl);
        this.toastService.show({
          title: selectedCategoryId === null ? 'Categoría creada' : 'Categoría actualizada',
          message: `La categoría ${category.name} ya está disponible en el panel admin.`,
        });
        this.loadData();
        this.startEdit(category);
      },
      error: () => {
        this.toastService.showError('No se pudo guardar la categoría.');
      },
    });
  }

  deleteCategory(category: AdminCategory): void {
    const confirmed = window.confirm(`¿Quieres eliminar la categoría "${category.name}"?`);

    if (!confirmed) {
      return;
    }

    this.saving.set(true);

    this.adminService
      .deleteCategory(category.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Categoría eliminada',
            message: `La categoría ${category.name} se ha eliminado correctamente.`,
          });
          this.loadData();

          if (this.selectedCategoryId() === category.id) {
            this.startCreate();
          }
        },
        error: () => {
          this.toastService.showError('No se pudo eliminar la categoría.');
        },
      });
  }

  onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.imageFile.set(file);

    if (!file) {
      this.setPreview(this.form.controls.imageUrl.value?.trim() || null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    this.form.patchValue({ imageUrl: previewUrl });
    this.setPreview(previewUrl, true);
  }

  onImageUrlInput(): void {
    if (this.imageFile()) {
      return;
    }

    this.setPreview(this.form.controls.imageUrl.value?.trim() || null);
  }

  clearImage(): void {
    this.imageFile.set(null);
    this.form.patchValue({ imageUrl: '' });
    this.setPreview(null);
  }

  private syncSelectedCatalogCategory(categories: readonly AdminCategory[]): void {
    const currentSelectedCatalogCategoryId = this.selectedCatalogCategoryId();

    if (
      currentSelectedCatalogCategoryId !== null &&
      categories.some((category) => category.id === currentSelectedCatalogCategoryId)
    ) {
      return;
    }

    this.selectedCatalogCategoryId.set(categories[0]?.id ?? null);
  }

  private bumpSubcategoryVersion(): void {
    this.subcategoryVersion.update((value) => value + 1);
  }

  private setPreview(url: string | null, isObjectUrl = false): void {
    this.releaseObjectUrl();

    if (isObjectUrl && url) {
      this.objectUrl = url;
    }

    this.imagePreview.set(url);
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private applyStoredImageUrl(imageUrl: string | null): void {
    const normalizedImageUrl = imageUrl?.trim() || '';

    if (!normalizedImageUrl) {
      return;
    }

    this.form.patchValue({ imageUrl: normalizedImageUrl });

    if (!window.isSecureContext || !navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(normalizedImageUrl).catch(() => undefined);
  }

  private scrollEditorIntoView(): void {
    window.setTimeout(() => {
      this.editorPanel?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 40);
  }

  private scrollSubcategoryPanelIntoView(): void {
    window.setTimeout(() => {
      this.subcategoryPanel?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 40);
  }
}
