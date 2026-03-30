import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UserAddress, UserAddressInput } from '../../core/interfaces/shop.interface';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-my-addresses',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './my-addresses.html',
})
export class MyAddresses {
  private readonly formBuilder = inject(FormBuilder);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly addresses = signal<readonly UserAddress[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedAddressId = signal<number | null>(null);
  readonly isEditing = computed(() => this.selectedAddressId() !== null);

  readonly form = this.formBuilder.group({
    address: ['', [Validators.required, Validators.maxLength(180)]],
    city: ['', [Validators.required, Validators.maxLength(120)]],
    country: ['', [Validators.required, Validators.maxLength(120)]],
    cp: ['', [Validators.required, Validators.maxLength(20)]],
    state: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor() {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.loading.set(true);

    this.shopService
      .getMyAddresses()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (addresses) => {
          this.addresses.set(addresses);
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudieron cargar tus direcciones.');
        },
      });
  }

  startCreate(): void {
    this.selectedAddressId.set(null);
    this.form.reset({
      address: '',
      city: '',
      country: '',
      cp: '',
      state: '',
    });
  }

  startEdit(address: UserAddress): void {
    this.selectedAddressId.set(address.id);
    this.form.reset({
      address: address.address,
      city: address.city,
      country: address.country,
      cp: address.cp,
      state: address.state,
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: UserAddressInput = {
      address: this.form.getRawValue().address?.trim() || '',
      city: this.form.getRawValue().city?.trim() || '',
      country: this.form.getRawValue().country?.trim() || '',
      cp: this.form.getRawValue().cp?.trim() || '',
      state: this.form.getRawValue().state?.trim() || '',
    };

    const selectedAddressId = this.selectedAddressId();
    const request$ =
      selectedAddressId === null
        ? this.shopService.createMyAddress(payload)
        : this.shopService.updateMyAddress(selectedAddressId, payload);

    this.saving.set(true);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
        next: (address) => {
          this.toastService.show({
            title: selectedAddressId === null ? 'Dirección creada' : 'Dirección actualizada',
            message: `${address.address} ya está guardada en tu cuenta.`,
          });
        this.loadAddresses();
        this.startEdit(address);
      },
      error: (error) => {
        this.toastService.showError(error.error?.message ?? 'No se pudo guardar la dirección.');
      },
    });
  }

  deleteAddress(address: UserAddress): void {
    const confirmed = window.confirm(`¿Quieres eliminar la dirección "${address.address}"?`);

    if (!confirmed) {
      return;
    }

    this.saving.set(true);

    this.shopService
      .deleteMyAddress(address.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Dirección eliminada',
            message: 'La dirección se ha eliminado correctamente.',
          });
          this.loadAddresses();

          if (this.selectedAddressId() === address.id) {
            this.startCreate();
          }
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo eliminar la dirección.');
        },
      });
  }
}
