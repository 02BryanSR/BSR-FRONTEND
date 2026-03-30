import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminCustomer, AdminCustomerInput } from '../../../core/interfaces/admin.interface';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './customers.html',
})
export class AdminCustomers {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  @ViewChild('editorPanel') private editorPanel?: ElementRef<HTMLElement>;

  readonly customers = signal<readonly AdminCustomer[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedCustomerId = signal<number | null>(null);
  readonly isEditing = computed(() => this.selectedCustomerId() !== null);
  readonly currentUser = this.authService.currentUser;

  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.maxLength(120)]],
    lastName: ['', [Validators.required, Validators.maxLength(120)]],
    number: [''],
    role: ['user', [Validators.required]],
    enabled: [true, [Validators.required]],
    password: ['', [Validators.minLength(6)]],
  });

  constructor() {
    this.syncPasswordRules();
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);

    this.adminService
      .getCustomers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (customers) => {
          this.customers.set(customers);
        },
        error: () => {
          this.customers.set([]);
          this.toastService.showError(
            'No se pudieron cargar los clientes. Revisa que el backend admin exponga /api/customers.',
          );
        },
      });
  }

  startCreate(): void {
    this.selectedCustomerId.set(null);
    this.syncPasswordRules();
    this.form.reset({
      email: '',
      firstName: '',
      lastName: '',
      number: '',
      role: 'user',
      enabled: true,
      password: '',
    });
  }

  startEdit(customer: AdminCustomer): void {
    this.selectedCustomerId.set(customer.id);
    this.syncPasswordRules();
    this.form.reset({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      number: customer.number === null ? '' : String(customer.number),
      role: customer.role,
      enabled: customer.enabled,
      password: '',
    });
    this.scrollEditorIntoView();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.showFormValidationError();
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload: AdminCustomerInput = {
      email: rawValue.email?.trim() || '',
      firstName: rawValue.firstName?.trim() || '',
      lastName: rawValue.lastName?.trim() || '',
      number: this.parseNumber(rawValue.number),
      role: rawValue.role === 'admin' ? 'admin' : 'user',
      enabled: !!rawValue.enabled,
      password: rawValue.password?.trim() || null,
    };

    const selectedCustomerId = this.selectedCustomerId();
    const request$ =
      selectedCustomerId === null
        ? this.adminService.createCustomer(payload)
        : this.adminService.updateCustomer(selectedCustomerId, payload);

    this.saving.set(true);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (customer) => {
        this.toastService.show({
          title: selectedCustomerId === null ? 'Usuario creado' : 'Usuario actualizado',
          message: `La cuenta de ${customer.email} ya esta sincronizada con el panel admin.`,
        });
        this.loadCustomers();
        this.startEdit(customer);
      },
      error: () => {
        this.toastService.showError('No se pudo guardar el cliente.');
      },
    });
  }

  toggleCustomerState(customer: AdminCustomer): void {
    const isSelf = this.currentUser()?.email === customer.email;

    if (isSelf && customer.enabled) {
      this.toastService.showError('No puedes desactivar la cuenta con la que has iniciado sesion.');
      return;
    }

    const nextEnabled = !customer.enabled;
    const actionLabel = nextEnabled ? 'reactivar' : 'desactivar';
    const confirmed = window.confirm(`Quieres ${actionLabel} al cliente "${customer.email}"?`);

    if (!confirmed) {
      return;
    }

    this.saving.set(true);

    this.adminService
      .updateCustomer(customer.id, {
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        number: customer.number,
        role: customer.role,
        enabled: nextEnabled,
        password: null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedCustomer) => {
          this.toastService.show({
            title: nextEnabled ? 'Cliente reactivado' : 'Cliente desactivado',
            message: `La cuenta ${customer.email} ahora esta ${updatedCustomer.enabled ? 'activa' : 'desactivada'}.`,
          });
          this.customers.update((customers) =>
            customers.map((currentCustomer) =>
              currentCustomer.id === updatedCustomer.id ? updatedCustomer : currentCustomer,
            ),
          );

          if (this.selectedCustomerId() === customer.id) {
            this.startEdit(updatedCustomer);
          }
        },
        error: () => {
          this.toastService.showError('No se pudo actualizar el estado del cliente.');
        },
      });
  }

  private syncPasswordRules(): void {
    const passwordControl = this.form.controls.password;
    passwordControl.clearValidators();

    if (this.selectedCustomerId() === null) {
      passwordControl.addValidators([Validators.required, Validators.minLength(6)]);
    } else {
      passwordControl.addValidators([Validators.minLength(6)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }

  private parseNumber(value: string | null | undefined): number | null {
    if (!value?.trim()) {
      return null;
    }

    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private scrollEditorIntoView(): void {
    window.setTimeout(() => {
      this.editorPanel?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 40);
  }
}
