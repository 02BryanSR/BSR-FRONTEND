import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogProduct } from '../../../core/interfaces/catalog.interface';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ToastService } from '../../../core/services/toast.service';

export type CatalogProductCardVariant = 'featured' | 'standard' | 'compact';

@Component({
  selector: 'app-catalog-product-card',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './catalog-product-card.html',
  host: {
    '[class]': 'hostClasses()',
  },
})
export class CatalogProductCardComponent {
  private readonly router = inject(Router);
  private readonly favoritesService = inject(FavoritesService);
  private readonly toastService = inject(ToastService);

  readonly product = input.required<CatalogProduct>();
  readonly variant = input<CatalogProductCardVariant>('standard');
  readonly busy = input(false);
  readonly add = output<CatalogProduct>();
  readonly isFavorite = computed(() => this.favoritesService.isFavorite(this.product().id));
  readonly imageBroken = signal(false);

  readonly hostClasses = computed(() => {
    switch (this.variant()) {
      case 'featured':
        return 'block h-full md:col-span-2 xl:col-span-4';
      case 'compact':
        return 'block h-full';
      default:
        return 'block h-full xl:col-span-2';
    }
  });

  readonly mediaClasses = computed(() => {
    switch (this.variant()) {
      case 'featured':
        return 'aspect-[4/5] min-h-[30rem] md:min-h-[38rem] xl:min-h-[44rem]';
      case 'compact':
        return 'aspect-[4/5] min-h-[18rem] md:min-h-[22rem] xl:min-h-[24rem]';
      default:
        return 'aspect-[4/5] min-h-[24rem] md:min-h-[30rem] xl:min-h-[34rem]';
    }
  });

  readonly titleClasses = computed(() => {
    switch (this.variant()) {
      case 'featured':
        return 'text-xl md:text-2xl';
      case 'compact':
        return 'text-sm md:text-base';
      default:
        return 'text-base md:text-lg';
    }
  });

  readonly bodyClasses = computed(() => {
    switch (this.variant()) {
      case 'featured':
        return 'pt-4';
      case 'compact':
        return 'pt-3';
      default:
        return 'pt-3.5';
    }
  });

  openProductDetail(): void {
    void this.router.navigate(['/products', this.product().id]);
  }

  markImageAsBroken(): void {
    this.imageBroken.set(true);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openProductDetail();
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();

    this.favoritesService.toggle(this.product().id).subscribe({
      next: (isFavorite) => {
        this.toastService.show({
          title: isFavorite ? 'Guardado en favoritos' : 'Eliminado de favoritos',
          message: `${this.product().name} ${isFavorite ? 'ya esta en tus favoritos' : 'ha salido de tus favoritos'}.`,
        });
      },
      error: (error) => {
        this.toastService.showError(
          error.error?.message ?? 'No se pudo actualizar el favorito.',
        );
      },
    });
  }

  requestAdd(event: Event): void {
    event.stopPropagation();
    this.add.emit(this.product());
  }
}
