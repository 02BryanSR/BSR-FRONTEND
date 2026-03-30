import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LoginRequest } from '../../core/interfaces/auth.interface';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);

  readonly loginForm = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required]),
  });

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate([this.authService.getHomeRoute()]);
    }
  }

  get emailCtrl(): AbstractControl<string> {
    return this.loginForm.controls.email;
  }

  get passwordCtrl(): AbstractControl<string> {
    return this.loginForm.controls.password;
  }

  get emailValid(): boolean {
    return this.emailCtrl.valid && this.emailCtrl.dirty;
  }

  get passwordValid(): boolean {
    return this.passwordCtrl.valid && this.passwordCtrl.dirty;
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const credentials: LoginRequest = this.loginForm.getRawValue();

    this.authService
      .login(credentials)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate([this.authService.getHomeRoute()]);
        },
        error: (error: HttpErrorResponse) => {
          this.toastService.showError(error.error?.message ?? 'Ha ocurrido un error. Intentalo de nuevo.');
        },
      });
  }
}
