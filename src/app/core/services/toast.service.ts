import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

export interface ToastState {
  visible: boolean;
  title: string;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly state = signal<ToastState>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  showError(message: string, duration = 4000): void {
    this.show({
      title: 'Algo salio mal',
      message,
      duration,
      type: 'error',
    });
  }

  showFormValidationError(
    message = 'Completa los campos obligatorios antes de continuar.',
    duration = 4000,
  ): void {
    this.show({
      title: 'Revisa el formulario',
      message,
      duration,
      type: 'error',
    });
  }

  show(toast: { title: string; message: string; duration?: number; type?: ToastType }): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.state.set({
      visible: true,
      title: toast.title,
      message: toast.message,
      type: toast.type ?? 'success',
    });

    this.timeoutId = setTimeout(() => {
      this.hide();
    }, toast.duration ?? 4000);
  }

  hide(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.state.update((current) => ({
      ...current,
      visible: false,
    }));
  }
}
