import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import {
  CATEGORY_SUBCATEGORY_OPTIONS,
  buildSubcategoryQueryParams,
  supportsCategorySubcategories,
} from '../../../core/constants/category-subcategories.constants';
import { PRIMARY_NAV_LINKS, type NavigationLink } from '../../../core/constants/navigation.constants';
import { type CatalogSubcategorySlug } from '../../../core/interfaces/catalog.interface';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ShopService } from '../../../core/services/shop.service';
import { AccountMenuComponent } from '../../../shared/components/account-menu/account-menu';
import { IconComponent } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [AccountMenuComponent, IconComponent, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly shopService = inject(ShopService);

  readonly currentUrl = signal(this.router.url);
  readonly isOpen = signal(false);
  readonly expandedNavRoute = signal<string | null>(null);
  readonly cartItemCount = this.shopService.cartItemCount;
  readonly subcategoryOptions = CATEGORY_SUBCATEGORY_OPTIONS;
  readonly navLinks = toSignal(this.catalogService.getNavigationLinks(), {
    initialValue: PRIMARY_NAV_LINKS,
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.close();
      });
  }

  toggle(): void {
    this.isOpen.update((value) => !value);
  }

  close(): void {
    this.isOpen.set(false);
    this.expandedNavRoute.set(null);
  }

  isHome(): boolean {
    return this.currentUrl() === '/home';
  }

  hasSubcategoryMenu(link: NavigationLink): boolean {
    return supportsCategorySubcategories(link.categorySlug);
  }

  toggleSubcategories(route: string): void {
    this.expandedNavRoute.update((currentRoute) => (currentRoute === route ? null : route));
  }

  getSubcategoryQueryParams(subcategory: CatalogSubcategorySlug): Record<string, string> {
    return buildSubcategoryQueryParams(subcategory);
  }
}
