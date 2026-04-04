import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { HIDDEN_LAYOUT_ROUTES } from './core/constants/navigation.constants';
import { Footer } from './layouts/components/footer/footer';
import { Header } from './layouts/components/header/header';
import { Sidebar } from './layouts/components/sidebar/sidebar';
import { ToastComponent } from './shared/components/toast/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Footer, Header, RouterOutlet, Sidebar, ToastComponent],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly title = signal('bsr-frontend');
  private readonly hiddenHeaderRoutes = new Set<string>(HIDDEN_LAYOUT_ROUTES);
  readonly currentUrl = signal(this.router.url);
  readonly currentPath = computed(() => this.currentUrl().split(/[?#]/, 1)[0] || '/');
  readonly showHeader = computed(
    () => !this.hiddenHeaderRoutes.has(this.currentPath()) && !this.currentPath().startsWith('/admin'),
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }
}
