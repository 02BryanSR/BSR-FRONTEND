import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClickOutsideDirective } from '../../directives/click-outside';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [ClickOutsideDirective, IconComponent, RouterLink],
  templateUrl: './account-menu.html',
})
export class AccountMenuComponent {
  readonly dark = input(false);
  readonly panelAlign = input<'left' | 'right'>('right');
  readonly authService = inject(AuthService);
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((value) => !value);
  }

  close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  handleLogout(): void {
    this.authService.logout({ redirectToLogin: false });
    this.close();
  }

  navigateAndClose(): void {
    this.close();
  }
}
