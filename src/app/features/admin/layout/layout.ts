import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon';

interface AdminNavItem {
  label: string;
  note: string;
  route: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [IconComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.html',
})
export class AdminLayout {
  private readonly authService = inject(AuthService);

  readonly menuOpen = signal(false);
  readonly currentUser = this.authService.currentUser;
  readonly userLabel = computed(
    () => this.currentUser()?.nombre?.trim() || this.currentUser()?.email || 'Administrador',
  );

  readonly navItems: readonly AdminNavItem[] = [
    { label: 'Resumen', note: 'Vista general', route: '/admin/dashboard' },
    { label: 'Categorias', note: 'Categorias, subcategorias y productos', route: '/admin/categories' },
    { label: 'Clientes', note: 'Usuarios y roles', route: '/admin/customers' },
    { label: 'Pedidos', note: 'Estados y detalle', route: '/admin/orders' },
  ];

  toggleMenu(): void {
    this.menuOpen.update((value) => !value);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.authService.logout({ redirectToPath: '/home' });
  }
}
