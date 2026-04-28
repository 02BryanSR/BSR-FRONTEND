import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { API_ENDPOINTS } from '../../core/constants/api.constants';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  onSubmit(): void {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.toastService.show({
        type: 'error',
        title: 'Token no válido',
        message: 'El enlace de recuperación no es válido.',
      });
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();

    if (password !== confirmPassword) {
      this.toastService.show({
        type: 'error',
        title: 'Contraseñas distintas',
        message: 'Las contraseñas no coinciden.',
      });
      return;
    }

    this.loading.set(true);

    this.http
      .post(API_ENDPOINTS.auth.resetPassword, {
        token,
        password,
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: () => {
          this.toastService.show({
            type: 'success',
            title: 'Contraseña actualizada',
            message: 'Tu contraseña se ha restablecido correctamente.',
          });

          this.form.reset();
          this.router.navigate(['/login']);
        },
        error: (error: HttpErrorResponse) => {
          this.toastService.show({
            type: 'error',
            title: 'No se pudo restablecer la contraseña',
            message: error.error?.message || 'El enlace puede haber expirado o ser invalido.',
          });
        },
      });
  }
}
