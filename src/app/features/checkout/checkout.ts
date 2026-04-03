import { CurrencyPipe } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { STRIPE_PUBLISHABLE_KEY } from '../../core/constants/api.constants';
import {
  CheckoutPaymentIntent,
  CreateOrderInput,
  CreatePaymentIntentInput,
  UserAddressInput,
  UserAddress,
} from '../../core/interfaces/shop.interface';
import { ResolvedAddress } from '../../core/interfaces/address-autocomplete.interface';
import { ShopService } from '../../core/services/shop.service';
import { ToastService } from '../../core/services/toast.service';
import { AddressAutocompleteComponent } from '../../shared/components/address-autocomplete/address-autocomplete';
import { StripePaymentElementComponent } from '../../shared/components/stripe-payment-element/stripe-payment-element';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    StripePaymentElementComponent,
    AddressAutocompleteComponent,
  ],
  templateUrl: './checkout.html',
})
export class Checkout {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly toastService = inject(ToastService);

  @ViewChild(StripePaymentElementComponent)
  private stripePaymentElement?: StripePaymentElementComponent;

  readonly cart = this.shopService.cart;
  readonly addresses = signal<readonly UserAddress[]>([]);
  readonly paymentIntent = signal<CheckoutPaymentIntent | null>(null);
  readonly preparedPaymentAddressId = signal<number | null>(null);
  readonly preparedPaymentMethod = signal<string | null>(null);
  readonly loadingCart = signal(true);
  readonly loadingAddresses = signal(true);
  readonly savingAddress = signal(false);
  readonly placingOrder = signal(false);
  readonly preparingPayment = signal(false);
  readonly paymentIntentError = signal<string | null>(null);
  readonly paymentElementReady = signal(false);
  readonly paymentElementComplete = signal(false);
  readonly paymentElementError = signal<string | null>(null);
  readonly showQuickAddressForm = signal(false);
  readonly stripeConfigured = !!STRIPE_PUBLISHABLE_KEY;
  readonly hasItems = computed(() => this.cart().items.length > 0);
  readonly hasAddresses = computed(() => this.addresses().length > 0);
  readonly isCardPayment = computed(() => this.checkoutForm.getRawValue().payMethod === 'CARD');
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

  readonly mockCardForm = this.formBuilder.group({
    cardholder: ['Nombre del cliente', [Validators.required, Validators.maxLength(60)]],
    cardNumber: ['4242 4242 4242 4242', [Validators.required, Validators.maxLength(19)]],
    expiry: ['12/34', [Validators.required, Validators.maxLength(5)]],
    cvc: ['123', [Validators.required, Validators.maxLength(4)]],
  });

  constructor() {
    this.loadCart();
    this.loadAddresses();

    this.checkoutForm.controls.addressId.valueChanges.subscribe(() => {
      void this.syncPaymentIntent();
    });
    this.checkoutForm.controls.payMethod.valueChanges.subscribe(() => {
      void this.syncPaymentIntent();
    });
  }

  loadCart(): void {
    this.loadingCart.set(true);

    this.shopService
      .loadMyCart()
      .pipe(finalize(() => this.loadingCart.set(false)))
      .subscribe({
        next: () => {
          void this.syncPaymentIntent();
        },
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

          if (!selectedAddressStillExists) {
            this.checkoutForm.patchValue({
              addressId: addresses[0]?.id ?? null,
            });
          }

          void this.syncPaymentIntent();
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

  async submitOrder(): Promise<void> {
    if (!this.hasItems()) {
      this.toastService.showError('Tu carrito está vacío.');
      void this.router.navigate(['/cart']);
      return;
    }

    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      return;
    }

    if (this.isCardPayment()) {
      await this.submitCardOrder();
      return;
    }

    this.createOrder({
      addressId: this.checkoutForm.getRawValue().addressId ?? 0,
      payMethod: this.checkoutForm.getRawValue().payMethod?.trim() || 'CARD',
    });
  }

  private async submitCardOrder(): Promise<void> {
    if (!this.stripeConfigured) {
      this.toastService.showError('Falta configurar Stripe en el frontend.');
      return;
    }

    if (!this.paymentElementReady()) {
      this.toastService.showError('El formulario de Stripe todavia no esta listo.');
      return;
    }

    if (!this.stripePaymentElement) {
      this.toastService.showError('El formulario de Stripe no esta montado en la pagina.');
      return;
    }

    const paymentIntent = await this.ensurePaymentIntent(true);

    if (!paymentIntent) {
      this.toastService.showError(
        this.paymentIntentError() || 'No se pudo preparar el cobro con tarjeta.',
      );
      return;
    }

    const paymentResult = await this.stripePaymentElement.confirmPayment(
      `${window.location.origin}/my-orders`,
    );

    if (!paymentResult?.success) {
      this.toastService.showError(
        paymentResult?.errorMessage ||
          this.paymentElementError() ||
          'La tarjeta no pudo confirmarse con Stripe.',
      );
      return;
    }

    if (!paymentIntent.paymentIntentId) {
      this.toastService.showError('Stripe no devolvió un identificador de pago válido.');
      return;
    }

    this.placingOrder.set(true);

    this.shopService
      .confirmPayment({ paymentIntentId: paymentIntent.paymentIntentId })
      .pipe(finalize(() => this.placingOrder.set(false)))
      .subscribe({
        next: (order) => {
          this.toastService.show({
            title: 'Pago confirmado',
            message: `Tu pedido #${order.id} ya ha quedado registrado.`,
          });
          void this.router.navigate(['/my-orders']);
        },
        error: (error) => {
          this.toastService.showError(
            error.error?.message ?? 'El pago fue aceptado, pero no se pudo cerrar el pedido.',
          );
        },
      });
  }

  private createOrder(payload: CreateOrderInput): void {
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

  private async syncPaymentIntent(): Promise<void> {
    if (!this.isCardPayment()) {
      this.paymentIntent.set(null);
      this.preparedPaymentAddressId.set(null);
      this.preparedPaymentMethod.set(null);
      this.paymentIntentError.set(null);
      this.paymentElementReady.set(false);
      this.paymentElementComplete.set(false);
      this.paymentElementError.set(null);
      return;
    }

    await this.ensurePaymentIntent();
  }

  private async ensurePaymentIntent(reuseExisting = false): Promise<CheckoutPaymentIntent | null> {
    if (!this.hasItems()) {
      this.paymentIntent.set(null);
      this.preparedPaymentAddressId.set(null);
      this.preparedPaymentMethod.set(null);
      return null;
    }

    const addressId = this.checkoutForm.getRawValue().addressId;
    const payMethod = this.checkoutForm.getRawValue().payMethod?.trim() || 'CARD';

    if (!addressId) {
      this.paymentIntent.set(null);
      this.preparedPaymentAddressId.set(null);
      this.preparedPaymentMethod.set(null);
      return null;
    }

    const currentPaymentIntent = this.paymentIntent();
    const canReuseCurrentIntent =
      !!currentPaymentIntent &&
      this.preparedPaymentAddressId() === addressId &&
      this.preparedPaymentMethod() === payMethod;

    if (reuseExisting && canReuseCurrentIntent) {
      return currentPaymentIntent;
    }

    if (!reuseExisting && canReuseCurrentIntent) {
      return currentPaymentIntent;
    }

    this.preparingPayment.set(true);
    this.paymentIntentError.set(null);
    this.paymentElementReady.set(false);
    this.paymentElementComplete.set(false);
    this.paymentElementError.set(null);

    return await new Promise<CheckoutPaymentIntent | null>((resolve) => {
      const payload: CreatePaymentIntentInput = {
        addressId,
        payMethod,
      };

      this.shopService
        .createPaymentIntent(payload)
        .pipe(finalize(() => this.preparingPayment.set(false)))
        .subscribe({
          next: (paymentIntent) => {
            if (!paymentIntent.clientSecret) {
              this.paymentIntent.set(null);
              this.preparedPaymentAddressId.set(null);
              this.preparedPaymentMethod.set(null);
              this.paymentIntentError.set('El backend no devolvió un client secret válido.');
              resolve(null);
              return;
            }

            this.paymentIntent.set(paymentIntent);
            this.preparedPaymentAddressId.set(addressId);
            this.preparedPaymentMethod.set(payMethod);
            resolve(paymentIntent);
          },
          error: (error) => {
            this.paymentIntent.set(null);
            this.preparedPaymentAddressId.set(null);
            this.preparedPaymentMethod.set(null);
            this.paymentIntentError.set(
              error.error?.message ||
                'No se pudo crear el PaymentIntent. Revisa el backend de Stripe.',
            );
            resolve(null);
          },
        });
    });
  }

  onPaymentStateChange(state: {
    complete: boolean;
    ready: boolean;
    errorMessage: string | null;
  }): void {
    this.paymentElementReady.set(state.ready);
    this.paymentElementComplete.set(state.complete);
    this.paymentElementError.set(state.errorMessage);
  }

  onQuickAddressInputChange(value: string): void {
    this.quickAddressForm.patchValue({ address: value }, { emitEvent: false });
  }

  onQuickAddressResolved(resolved: ResolvedAddress): void {
    this.applyResolvedAddressToQuickForm(resolved);
  }

  formatMockCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    this.mockCardForm.patchValue({ cardNumber: formatted }, { emitEvent: false });
  }

  formatMockExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    this.mockCardForm.patchValue({ expiry: formatted }, { emitEvent: false });
  }

  formatMockCvc(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    this.mockCardForm.patchValue({ cvc: digits }, { emitEvent: false });
  }

  get mockCardholder(): string {
    return (this.mockCardForm.getRawValue().cardholder || 'Nombre del cliente').trim();
  }

  get mockCardNumber(): string {
    const digits = (this.mockCardForm.getRawValue().cardNumber || '').replace(/\D/g, '');
    const padded = `${digits}${'•'.repeat(Math.max(0, 16 - digits.length))}`.slice(0, 16);
    return padded.replace(/(.{4})/g, '$1 ').trim();
  }

  get mockExpiry(): string {
    return (this.mockCardForm.getRawValue().expiry || 'MM/AA').trim() || 'MM/AA';
  }

  get mockCvc(): string {
    const value = (this.mockCardForm.getRawValue().cvc || '').trim();
    return value ? '•'.repeat(value.length) : '•••';
  }

  get mockCardBrand(): string {
    const digits = (this.mockCardForm.getRawValue().cardNumber || '').replace(/\D/g, '');

    if (/^3[47]/.test(digits)) {
      return 'Amex';
    }

    if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) {
      return 'Mastercard';
    }

    if (/^4/.test(digits)) {
      return 'Visa';
    }

    return 'Card';
  }

  private applyResolvedAddressToQuickForm(resolved: ResolvedAddress): void {
    this.quickAddressForm.patchValue(
      {
        address: resolved.address || resolved.formattedAddress,
        city: resolved.city || this.quickAddressForm.getRawValue().city || '',
        state: resolved.state || this.quickAddressForm.getRawValue().state || '',
        country: resolved.country || this.quickAddressForm.getRawValue().country || '',
        cp: resolved.cp || this.quickAddressForm.getRawValue().cp || '',
      },
      { emitEvent: false },
    );
  }
}
