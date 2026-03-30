import { Component, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import {
  CATEGORY_SUBCATEGORY_OPTIONS,
  buildSubcategoryQueryParams,
  supportsCategorySubcategories,
} from '../../../core/constants/category-subcategories.constants';
import { PRIMARY_NAV_LINKS, type NavigationLink } from '../../../core/constants/navigation.constants';
import { type CatalogSearchItem, type CatalogSubcategorySlug } from '../../../core/interfaces/catalog.interface';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ShopService } from '../../../core/services/shop.service';
import { AccountMenuComponent } from '../../../shared/components/account-menu/account-menu';
import { IconComponent } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AccountMenuComponent, IconComponent, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
})
export class Header {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly shopService = inject(ShopService);

  @ViewChild('searchShell') private searchShell?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('navShell') private navShell?: ElementRef<HTMLElement>;

  readonly currentUrl = signal(this.router.url);
  readonly isHome = computed(() => this.currentUrl() === '/home');
  readonly cartItemCount = this.shopService.cartItemCount;
  readonly searchOpen = signal(false);
  readonly openNavRoute = signal<string | null>(null);
  readonly subcategoryOptions = CATEGORY_SUBCATEGORY_OPTIONS;
  readonly searchQuery = signal('');
  readonly navLinks = toSignal(this.catalogService.getNavigationLinks(), {
    initialValue: PRIMARY_NAV_LINKS,
  });
  private readonly searchEntries = toSignal(this.catalogService.getSearchEntries(), {
    initialValue: [] as readonly CatalogSearchItem[],
  });
  readonly searchResults = computed(() => {
    const query = this.normalizeSearch(this.searchQuery());
    const terms = query.split(/\s+/).filter(Boolean);

    if (!terms.length) {
      return [];
    }

    return this.getAvailableSearchEntries()
      .map((item) => ({
        item,
        score: this.scoreSearchItem(item, query, terms),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map((entry) => entry.item);
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeSearch();
        this.closeNavDropdown();
      });

    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.shopService.loadMyCart().subscribe({
          error: () => this.shopService.resetCart(),
        });
        return;
      }

      this.shopService.resetCart();
    });
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    this.closeSearch();
    this.closeNavDropdown();
  }

  @HostListener('document:click', ['$event'])
  protected handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    const searchShell = this.searchShell?.nativeElement;
    const navShell = this.navShell?.nativeElement;

    if (this.searchOpen() && searchShell && !searchShell.contains(target)) {
      this.closeSearch();
    }

    if (this.openNavRoute() && navShell && !navShell.contains(target)) {
      this.closeNavDropdown();
    }
  }

  toggleSearch(): void {
    this.closeNavDropdown();

    if (this.searchOpen()) {
      if (!this.searchQuery().trim()) {
        this.closeSearch();
        return;
      }

      this.focusSearchInput();
      return;
    }

    this.searchOpen.set(true);
    this.focusSearchInput();
  }

  hasSubcategoryMenu(link: NavigationLink): boolean {
    return supportsCategorySubcategories(link.categorySlug);
  }

  toggleNavDropdown(route: string): void {
    this.closeSearch();
    this.openNavRoute.update((currentRoute) => (currentRoute === route ? null : route));
  }

  closeNavDropdown(): void {
    this.openNavRoute.set(null);
  }

  getSubcategoryQueryParams(subcategory: CatalogSubcategorySlug): Record<string, string> {
    return buildSubcategoryQueryParams(subcategory);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);

    if (!this.searchOpen()) {
      this.searchOpen.set(true);
    }
  }

  submitSearch(event: Event): void {
    event.preventDefault();

    const [firstResult] = this.searchResults();

    if (firstResult) {
      this.openSearchResult(firstResult);
    }
  }

  openSearchResult(result: CatalogSearchItem): void {
    this.closeSearch({ resetQuery: true });
    void this.router.navigateByUrl(result.route);
  }

  getSearchTypeLabel(item: CatalogSearchItem): string {
    switch (item.type) {
      case 'category':
        return 'Categoria';
      case 'product':
        return 'Producto';
      default:
        return 'Pagina';
    }
  }

  private closeSearch(options: { resetQuery?: boolean } = {}): void {
    const { resetQuery = true } = options;

    this.searchOpen.set(false);

    if (resetQuery) {
      this.searchQuery.set('');
    }
  }

  private focusSearchInput(): void {
    window.setTimeout(() => this.searchInput?.nativeElement.focus(), 40);
  }

  private getAvailableSearchEntries(): readonly CatalogSearchItem[] {
    const pageEntries: CatalogSearchItem[] = [
      {
        type: 'page',
        id: 1,
        title: 'Inicio',
        subtitle: 'Volver al inicio del catalogo',
        route: '/home',
        imageUrl: null,
        keywords: ['home', 'inicio', 'catalogo', 'principal'],
      },
    ];

    if (this.authService.isAuthenticated()) {
      pageEntries.push(
        {
          type: 'page',
          id: 2,
          title: 'Carrito',
          subtitle: 'Gestionar tu compra',
          route: '/cart',
          imageUrl: null,
          keywords: ['cart', 'carrito', 'compra', 'bolsa', 'pedido'],
        },
        {
          type: 'page',
          id: 3,
          title: 'Favoritos',
          subtitle: 'Tus productos guardados',
          route: '/favorites',
          imageUrl: null,
          keywords: ['favoritos', 'wishlist', 'guardados', 'gustados'],
        },
        {
          type: 'page',
          id: 4,
          title: 'Mis pedidos',
          subtitle: 'Historial y seguimiento',
          route: '/my-orders',
          imageUrl: null,
          keywords: ['pedidos', 'compras', 'historial', 'ordenes'],
        },
        {
          type: 'page',
          id: 5,
          title: 'Mis direcciones',
          subtitle: 'Gestionar envio y checkout',
          route: '/my-addresses',
          imageUrl: null,
          keywords: ['direcciones', 'envio', 'checkout', 'address'],
        },
      );
    }

    if (this.authService.isAdmin()) {
      pageEntries.push(
        {
          type: 'page',
          id: 6,
          title: 'Panel admin',
          subtitle: 'Entrar al panel de administracion',
          route: '/admin',
          imageUrl: null,
          keywords: ['admin', 'panel', 'gestion', 'dashboard'],
        },
        {
          type: 'page',
          id: 7,
          title: 'Productos admin',
          subtitle: 'Gestionar catalogo y stock',
          route: '/admin/products',
          imageUrl: null,
          keywords: ['productos', 'catalogo', 'admin', 'gestion'],
        },
        {
          type: 'page',
          id: 8,
          title: 'Categorias admin',
          subtitle: 'Gestionar categorias y banners',
          route: '/admin/categories',
          imageUrl: null,
          keywords: ['categorias', 'banner', 'admin', 'gestion'],
        },
      );
    }

    return [...pageEntries, ...this.searchEntries()];
  }

  private scoreSearchItem(
    item: CatalogSearchItem,
    query: string,
    terms: readonly string[],
  ): number {
    const title = this.normalizeSearch(item.title);
    const subtitle = this.normalizeSearch(item.subtitle);
    const keywords = item.keywords.map((keyword) => this.normalizeSearch(keyword)).filter(Boolean);
    const haystack = [title, subtitle, ...keywords].join(' ');
    const tokens = haystack.split(/\s+/).filter(Boolean);

    let score = 0;

    for (const term of terms) {
      if (title.startsWith(term)) {
        score += 120;
        continue;
      }

      if (title.includes(term)) {
        score += 90;
        continue;
      }

      if (keywords.some((keyword) => keyword.startsWith(term))) {
        score += 70;
        continue;
      }

      if (keywords.some((keyword) => keyword.includes(term))) {
        score += 55;
        continue;
      }

      if (tokens.some((token) => token.startsWith(term))) {
        score += 40;
        continue;
      }

      if (tokens.some((token) => this.isNearMatch(term, token))) {
        score += 25;
        continue;
      }

      return 0;
    }

    if (title === query) {
      score += 110;
    } else if (haystack.includes(query)) {
      score += 35;
    }

    if (item.type === 'product') {
      score += 5;
    }

    return score;
  }

  private normalizeSearch(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private isNearMatch(term: string, token: string): boolean {
    if (term.length < 4 || token.length < 4) {
      return false;
    }

    if (Math.abs(term.length - token.length) > 1) {
      return false;
    }

    let mismatches = 0;
    let termIndex = 0;
    let tokenIndex = 0;

    while (termIndex < term.length && tokenIndex < token.length) {
      if (term[termIndex] === token[tokenIndex]) {
        termIndex += 1;
        tokenIndex += 1;
        continue;
      }

      mismatches += 1;

      if (mismatches > 1) {
        return false;
      }

      if (term.length > token.length) {
        termIndex += 1;
        continue;
      }

      if (token.length > term.length) {
        tokenIndex += 1;
        continue;
      }

      termIndex += 1;
      tokenIndex += 1;
    }

    mismatches += term.length - termIndex + token.length - tokenIndex;
    return mismatches <= 1;
  }
}
