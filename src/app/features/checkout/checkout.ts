import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CreateOrderInput, UserAddress, UserAddressInput } from '../../core/interfaces/shop.interface';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
})
export class Checkout {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  readonly cart = this.shopService.cart;
  readonly addresses = signal<readonly UserAddress[]>([]);
  readonly loadingCart = signal(true);
  readonly loadingAddresses = signal(true);
  readonly savingAddress = signal(false);
  readonly placingOrder = signal(false);
  readonly showQuickAddressForm = signal(false);
  readonly hasItems = computed(() => this.cart().items.length > 0);
  readonly hasAddresses = computed(() => this.addresses().length > 0);
  readonly selectedAddress = computed(() => {
    const selectedId = this.checkoutForm.getRawValue().addressId;
    return this.addresses().find((address) => address.id === selectedId) ?? null;
  });

  readonly checkoutForm = this.formBuilder.group({
    addressId: this.formBuilder.control<number | null>(null, Validators.required),
    payMethod: this.formBuilder.control('CARD', Validators.required),
  });

  readonly quickAddressForm = this.formBuilder.group({
    address: ['', [Validators.required, Validators.maxLength(180)]],
    city: ['', [Validators.required, Validators.maxLength(120)]],
    country: ['', [Validators.required, Validators.maxLength(120)]],
    cp: ['', [Validators.required, Validators.maxLength(20)]],
    state: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor() {
    this.loadCart();
    this.loadAddresses();
  }

  loadCart(): void {
    this.loadingCart.set(true);

    this.shopService
      .loadMyCart()
      .pipe(finalize(() => this.loadingCart.set(false)))
      .subscribe({
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo cargar el carrito.');
        },
      });
  }

  loadAddresses(): void {
    this.loadingAddresses.set(true);

    this.shopService
      .getMyAddresses()
      .pipe(finalize(() => this.loadingAddresses.set(false)))
      .subscribe({
        next: (addresses) => {
          this.addresses.set(addresses);

          const currentAddressId = this.checkoutForm.getRawValue().addressId;
          const selectedAddressStillExists = addresses.some((address) => address.id === currentAddressId);

          if (selectedAddressStillExists) {
            return;
          }

          this.checkoutForm.patchValue({
            addressId: addresses[0]?.id ?? null,
          });
        },
        error: (error) => {
          this.toastService.showError(
            error.error?.message ?? 'No se pudieron cargar tus direcciones.',
          );
        },
      });
  }

  toggleQuickAddressForm(): void {
    this.showQuickAddressForm.update((value) => !value);

    if (!this.showQuickAddressForm()) {
      this.quickAddressForm.reset({
        address: '',
        city: '',
        country: '',
        cp: '',
        state: '',
      });
    }
  }

  createQuickAddress(): void {
    if (this.quickAddressForm.invalid) {
      this.quickAddressForm.markAllAsTouched();
      return;
    }

    const payload: UserAddressInput = {
      address: this.quickAddressForm.getRawValue().address?.trim() || '',
      city: this.quickAddressForm.getRawValue().city?.trim() || '',
      country: this.quickAddressForm.getRawValue().country?.trim() || '',
      cp: this.quickAddressForm.getRawValue().cp?.trim() || '',
      state: this.quickAddressForm.getRawValue().state?.trim() || '',
    };

    this.savingAddress.set(true);

    this.shopService
      .createMyAddress(payload)
      .pipe(finalize(() => this.savingAddress.set(false)))
      .subscribe({
        next: (address) => {
          this.toastService.show({
            title: 'Dirección guardada',
            message: 'Ya puedes usarla para completar tu pedido.',
          });
          this.showQuickAddressForm.set(false);
          this.quickAddressForm.reset({
            address: '',
            city: '',
            country: '',
            cp: '',
            state: '',
          });
          this.addresses.update((currentAddresses) => [...currentAddresses, address]);
          this.checkoutForm.patchValue({ addressId: address.id });
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo crear la dirección.');
        },
      });
  }

  submitOrder(): void {
    if (!this.hasItems()) {
      this.toastService.showError('Tu carrito está vacío.');
      void this.router.navigate(['/cart']);
      return;
    }

    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      return;
    }

    const payload: CreateOrderInput = {
      addressId: this.checkoutForm.getRawValue().addressId ?? 0,
      payMethod: this.checkoutForm.getRawValue().payMethod?.trim() || 'CARD',
    };

    this.placingOrder.set(true);

    this.shopService
      .createMyOrder(payload)
      .pipe(finalize(() => this.placingOrder.set(false)))
      .subscribe({
        next: (order) => {
          this.toastService.show({
            title: 'Pedido creado',
            message: `Tu pedido #${order.id} ya ha quedado registrado.`,
          });
          void this.router.navigate(['/my-orders']);
        },
        error: (error) => {
          this.toastService.showError(error.error?.message ?? 'No se pudo crear el pedido.');
        },
      });
  }
}
