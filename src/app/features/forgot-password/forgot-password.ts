import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { API_ENDPOINTS } from '../../core/constants/api.constants';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get email() {
    return this.form.controls.email;
  }

  onSubmit(): void {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.getRawValue().email.trim().toLowerCase();

    this.loading.set(true);

    this.http
      .post(API_ENDPOINTS.auth.forgotPassword, { email })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: () => {
          this.toastService.show({
            type: 'success',
            title: 'Correo enviado',
            message: 'Se ha enviado el correo de recuperación.',
          });

          this.form.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.toastService.show({
            type: 'error',
            title: 'No se pudo enviar el correo',
            message: error.error?.message || 'No se pudo procesar la solicitud de recuperación.',
          });
        },
      });
  }
}
