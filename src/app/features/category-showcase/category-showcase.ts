import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { type CatalogProduct, type CatalogSubcategorySlug } from '../../core/interfaces/catalog.interface';
import { AuthService } from '../../core/services/auth.service';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CatalogProductCardComponent,
  CatalogProductCardVariant,
} from '../../shared/components/catalog-product-card/catalog-product-card';
import { CategorySubcategoryNavComponent } from '../../shared/components/category-subcategory-nav/category-subcategory-nav';
import { SurfaceCardComponent } from '../../shared/components/surface-card/surface-card';

export interface CategoryShowcasePanel {
  eyebrow: string;
  title: string;
  description: string;
}

export interface CategoryShowcaseImage {
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-category-showcase',
  standalone: true,
  imports: [CatalogProductCardComponent, CategorySubcategoryNavComponent, SurfaceCardComponent],
  templateUrl: './category-showcase.html',
})
export class CategoryShowcaseComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly accent = input.required<string>();
  readonly heroImage = input.required<string>();
  readonly heroAlt = input.required<string>();
  readonly highlights = input.required<readonly string[]>();
  readonly panels = input.required<readonly CategoryShowcasePanel[]>();
  readonly gallery = input.required<readonly CategoryShowcaseImage[]>();
  readonly products = input.required<readonly CatalogProduct[]>();
  readonly selectedSubcategory = input<CatalogSubcategorySlug>('all');
  readonly addingProductId = signal<number | null>(null);
  readonly currentPath = this.router.url.split('?')[0] || '/home';
  readonly supportsSubcategories = computed(() => this.currentPath !== '/accessories');
  readonly selectedSubcategoryLabel = computed(() => {
    switch (this.selectedSubcategory()) {
      case 'superiores':
        return 'Superiores';
      case 'inferiores':
        return 'Inferiores';
      case 'conjuntos':
        return 'Conjuntos';
      case 'calzado':
        return 'Calzado';
      default:
        return 'Ver todo';
    }
  });

  readonly responsiveGallery = computed(() => {
    const heroSrc = this.heroImage().trim();
    const seen = new Set(heroSrc ? [heroSrc] : []);

    return this.gallery().filter((image) => {
      const imageSrc = image.src?.trim();

      if (!imageSrc || seen.has(imageSrc)) {
        return false;
      }

      seen.add(imageSrc);

      return true;
    });
  });

  readonly productCards = computed(() =>
    this.products().map((product, index, products) => ({
      product,
      variant: this.getProductCardVariant(index, products.length),
    })),
  );

  addToCart(product: CatalogProduct): void {
    if ((product.stock ?? 0) <= 0) {
      this.toastService.showError('Producto agotado. Ya no se puede añadir al carrito.');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.toastService.show({
        title: 'Necesitas iniciar sesión',
        message: 'Inicia sesión para añadir productos al carrito.',
      });
      void this.router.navigate(['/login']);
      return;
    }

    this.addingProductId.set(product.id);

    this.shopService
      .addItem(product.id, 1)
      .pipe(finalize(() => this.addingProductId.set(null)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Producto añadido',
            message: `${product.name} ya está en tu carrito.`,
          });
        },
        error: (error) => {
          this.toastService.showError(
            error.error?.message ?? 'No se pudo añadir el producto al carrito.',
          );
        },
      });
  }

  private getProductCardVariant(
    index: number,
    totalProducts: number,
  ): CatalogProductCardVariant {
    if (totalProducts <= 1) {
      return 'featured';
    }

    if (totalProducts === 2) {
      return 'standard';
    }

    if (totalProducts === 4) {
      return 'compact';
    }

    if (totalProducts === 3) {
      return index === 0 ? 'featured' : 'standard';
    }

    const pattern: readonly CatalogProductCardVariant[] = [
      'featured',
      'standard',
      'standard',
      'compact',
      'compact',
      'compact',
      'compact',
    ];

    return pattern[index % pattern.length];
  }
}
