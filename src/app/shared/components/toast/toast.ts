import { Component, computed, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './toast.html',
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);

  readonly toast = computed(() => this.toastService.state());

  close(): void {
    this.toastService.hide();
  }
}
