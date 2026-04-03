import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import {
  Stripe,
  StripeCardCvcElement,
  StripeCardExpiryElement,
  StripeCardNumberElement,
  StripeElements,
  loadStripe,
} from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '../../../core/constants/api.constants';

type PaymentMode = 'demo' | 'stripe';
type TestCardBrand = 'visa' | 'mastercard' | 'amex';
type CardFieldKey = 'number' | 'expiry' | 'cvc';

type CardFieldState = {
  complete: boolean;
  error: string | null;
  ready: boolean;
};

type CardBrandPreset = {
  number: string;
  expiry: string;
  cvc: string;
};

const INITIAL_FIELD_STATE: Record<CardFieldKey, CardFieldState> = {
  number: { complete: false, error: null, ready: false },
  expiry: { complete: false, error: null, ready: false },
  cvc: { complete: false, error: null, ready: false },
};

const CARD_BRAND_PRESETS: Record<TestCardBrand, CardBrandPreset> = {
  visa: {
    number: '4242 4242 4242 4242',
    expiry: '12/34',
    cvc: '123',
  },
  mastercard: {
    number: '5555 5555 5555 4444',
    expiry: '12/34',
    cvc: '123',
  },
  amex: {
    number: '3782 822463 10005',
    expiry: '12/34',
    cvc: '1234',
  },
};

@Component({
  selector: 'app-stripe-payment-element',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-payment-element.html',
})
export class StripePaymentElementComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() clientSecret = '';
  @Input() mode: PaymentMode = 'demo';

  @Output() paymentStateChange = new EventEmitter<{
    complete: boolean;
    ready: boolean;
    errorMessage: string | null;
  }>();

  @ViewChild('cardNumberHost') private cardNumberHost?: ElementRef<HTMLDivElement>;
  @ViewChild('cardExpiryHost') private cardExpiryHost?: ElementRef<HTMLDivElement>;
  @ViewChild('cardCvcHost') private cardCvcHost?: ElementRef<HTMLDivElement>;

  readonly loading = signal(false);
  readonly ready = signal(false);
  readonly complete = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly brands: ReadonlyArray<{ key: TestCardBrand; label: string }> = [
    { key: 'visa', label: 'Visa' },
    { key: 'mastercard', label: 'Mastercard' },
    { key: 'amex', label: 'Amex' },
  ];
  readonly selectedBrand = signal<TestCardBrand>('visa');
  readonly demoCardNumber = signal(CARD_BRAND_PRESETS.visa.number);
  readonly demoExpiry = signal(CARD_BRAND_PRESETS.visa.expiry);
  readonly demoCvc = signal(CARD_BRAND_PRESETS.visa.cvc);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardNumberElement: StripeCardNumberElement | null = null;
  private cardExpiryElement: StripeCardExpiryElement | null = null;
  private cardCvcElement: StripeCardCvcElement | null = null;
  private fieldState: Record<CardFieldKey, CardFieldState> = {
    number: { ...INITIAL_FIELD_STATE.number },
    expiry: { ...INITIAL_FIELD_STATE.expiry },
    cvc: { ...INITIAL_FIELD_STATE.cvc },
  };
  private mounted = false;
  private viewReady = false;

  async ngAfterViewInit(): Promise<void> {
    this.viewReady = true;
    await this.setupCurrentMode();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (this.viewReady && (changes['clientSecret'] || changes['mode'])) {
      await this.setupCurrentMode();
    }
  }

  ngOnDestroy(): void {
    this.destroyCardElements();
  }

  async confirmPayment(_returnUrl?: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (this.mode === 'demo') {
      const errorMessage = this.validateDemoFields();

      this.errorMessage.set(errorMessage);
      this.ready.set(true);
      this.complete.set(!errorMessage);
      this.emitState();

      if (errorMessage) {
        return {
          success: false,
          errorMessage,
        };
      }

      return { success: true };
    }

    const clientSecret = this.clientSecret.trim();

    if (!this.stripe || !this.cardNumberElement || !clientSecret) {
      return {
        success: false,
        errorMessage: 'Stripe no esta listo todavia.',
      };
    }

    if (!this.complete()) {
      return {
        success: false,
        errorMessage: 'Completa correctamente los datos de pago.',
      };
    }

    try {
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardNumberElement,
        },
      });

      if (result.error) {
        const message = this.describeStripeError(
          result.error,
          'No se pudo confirmar el pago con Stripe.',
        );
        this.errorMessage.set(message);
        this.emitState();
        return {
          success: false,
          errorMessage: message,
        };
      }

      this.errorMessage.set(null);
      this.emitState();
      return { success: true };
    } catch (error) {
      const message = this.describeStripeError(
        error,
        'Stripe lanzo un error inesperado al confirmar el pago.',
      );
      this.errorMessage.set(message);
      this.emitState();
      return {
        success: false,
        errorMessage: message,
      };
    }
  }

  selectBrand(brand: TestCardBrand): void {
    this.selectedBrand.set(brand);

    if (this.mode === 'demo') {
      this.applyDemoBrandPreset(brand);
      return;
    }

    this.applyStripeBrandPreset(brand, true);
    this.cardNumberElement?.focus();
  }

  onDemoCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    const detectedBrand = this.detectBrand(digits) || this.selectedBrand();
    const formatted = this.formatCardNumber(digits, detectedBrand);

    this.selectedBrand.set(detectedBrand);
    this.demoCardNumber.set(formatted);
    this.syncDemoState();
  }

  onDemoExpiryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.demoExpiry.set(this.formatExpiry(input.value));
    this.syncDemoState();
  }

  onDemoCvcInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const maxLength = this.selectedBrand() === 'amex' ? 4 : 3;
    this.demoCvc.set(input.value.replace(/\D/g, '').slice(0, maxLength));
    this.syncDemoState();
  }

  private async setupCurrentMode(): Promise<void> {
    if (this.mode === 'demo') {
      this.destroyCardElements();
      this.loading.set(false);
      this.initializeDemoState();
      return;
    }

    await this.mountCardElements();
  }

  private initializeDemoState(): void {
    this.applyDemoBrandPreset(this.selectedBrand());
  }

  private async mountCardElements(): Promise<void> {
    const clientSecret = this.clientSecret.trim();
    const numberHost = this.cardNumberHost?.nativeElement;
    const expiryHost = this.cardExpiryHost?.nativeElement;
    const cvcHost = this.cardCvcHost?.nativeElement;

    if (!this.viewReady || !clientSecret || !numberHost || !expiryHost || !cvcHost) {
      return;
    }

    if (!STRIPE_PUBLISHABLE_KEY) {
      this.errorMessage.set('Falta configurar la clave publica de Stripe.');
      this.emitState();
      return;
    }

    this.loading.set(true);
    this.resetFieldState();
    this.errorMessage.set(null);
    this.emitState();
    this.destroyCardElements();

    try {
      this.stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY, {
        developerTools: {
          assistant: {
            enabled: false,
          },
        },
      });

      if (!this.stripe) {
        this.errorMessage.set('No se pudo inicializar Stripe.');
        this.emitState();
        return;
      }

      this.elements = this.stripe.elements();
      const preset = this.getBrandPreset(this.selectedBrand());

      const baseStyle = {
        color: '#111111',
        fontFamily: 'inherit',
        fontSize: '16px',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: '#a3a3a3',
        },
      } as const;

      const invalidStyle = {
        color: '#111111',
        iconColor: '#b91c1c',
      } as const;

      this.cardNumberElement = this.elements.create('cardNumber', {
        disableLink: true,
        placeholder: preset.number,
        showIcon: false,
        style: {
          base: baseStyle,
          invalid: invalidStyle,
        },
      });

      this.cardExpiryElement = this.elements.create('cardExpiry', {
        placeholder: preset.expiry,
        style: {
          base: baseStyle,
          invalid: invalidStyle,
        },
      });

      this.cardCvcElement = this.elements.create('cardCvc', {
        placeholder: preset.cvc,
        style: {
          base: baseStyle,
          invalid: invalidStyle,
        },
      });

      this.registerCardNumberEvents(this.cardNumberElement);
      this.registerCardExpiryEvents(this.cardExpiryElement);
      this.registerCardCvcEvents(this.cardCvcElement);

      this.cardNumberElement.mount(numberHost);
      this.cardExpiryElement.mount(expiryHost);
      this.cardCvcElement.mount(cvcHost);
      this.mounted = true;
    } catch (error) {
      const message = this.describeStripeError(
        error,
        'No se pudo cargar el formulario seguro de tarjeta.',
      );
      this.errorMessage.set(message);
      this.emitState();
    } finally {
      this.loading.set(false);
    }
  }

  private registerCardNumberEvents(element: StripeCardNumberElement): void {
    element.on('ready', () => {
      this.markFieldReady('number');
    });

    element.on('change', (event) => {
      this.fieldState.number.complete = !!event.complete;
      this.fieldState.number.error = event.error?.message ?? null;

      if (event.brand === 'visa' || event.brand === 'mastercard' || event.brand === 'amex') {
        this.selectedBrand.set(event.brand);
        this.applyStripeBrandPreset(event.brand, false);
      }

      this.syncStripeState();
    });

    element.on('loaderror', (event) => {
      this.errorMessage.set(event.error?.message || 'Stripe no pudo cargar el numero de tarjeta.');
      this.emitState();
    });
  }

  private registerCardExpiryEvents(element: StripeCardExpiryElement): void {
    element.on('ready', () => {
      this.markFieldReady('expiry');
    });

    element.on('change', (event) => {
      this.fieldState.expiry.complete = !!event.complete;
      this.fieldState.expiry.error = event.error?.message ?? null;
      this.syncStripeState();
    });
  }

  private registerCardCvcEvents(element: StripeCardCvcElement): void {
    element.on('ready', () => {
      this.markFieldReady('cvc');
    });

    element.on('change', (event) => {
      this.fieldState.cvc.complete = !!event.complete;
      this.fieldState.cvc.error = event.error?.message ?? null;
      this.syncStripeState();
    });
  }

  private markFieldReady(field: CardFieldKey): void {
    this.fieldState[field].ready = true;
    this.syncStripeState();
  }

  private syncStripeState(): void {
    const firstError =
      this.fieldState.number.error || this.fieldState.expiry.error || this.fieldState.cvc.error;

    this.ready.set(
      this.fieldState.number.ready && this.fieldState.expiry.ready && this.fieldState.cvc.ready,
    );
    this.complete.set(
      this.fieldState.number.complete &&
        this.fieldState.expiry.complete &&
        this.fieldState.cvc.complete,
    );
    this.errorMessage.set(firstError);
    this.emitState();
  }

  private syncDemoState(): void {
    const errorMessage = this.validateDemoFields();

    this.ready.set(true);
    this.complete.set(!errorMessage);
    this.errorMessage.set(errorMessage);
    this.emitState();
  }

  private validateDemoFields(): string | null {
    const brand = this.selectedBrand();
    const numberDigits = this.demoCardNumber().replace(/\D/g, '');
    const expectedNumberLength = brand === 'amex' ? 15 : 16;

    if (numberDigits.length !== expectedNumberLength) {
      return `El numero de tarjeta debe tener ${expectedNumberLength} digitos.`;
    }

    const expiryDigits = this.demoExpiry().replace(/\D/g, '');

    if (expiryDigits.length !== 4) {
      return 'La fecha de caducidad no es valida.';
    }

    const month = Number(expiryDigits.slice(0, 2));

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return 'La fecha de caducidad no es valida.';
    }

    const cvcDigits = this.demoCvc().replace(/\D/g, '');
    const expectedCvcLength = brand === 'amex' ? 4 : 3;

    if (cvcDigits.length !== expectedCvcLength) {
      return `El codigo de seguridad debe tener ${expectedCvcLength} digitos.`;
    }

    return null;
  }

  private applyDemoBrandPreset(brand: TestCardBrand): void {
    const preset = this.getBrandPreset(brand);
    this.demoCardNumber.set(preset.number);
    this.demoExpiry.set(preset.expiry);
    this.demoCvc.set(preset.cvc);
    this.errorMessage.set(null);
    this.syncDemoState();
  }

  private applyStripeBrandPreset(brand: TestCardBrand, clearValues: boolean): void {
    const preset = this.getBrandPreset(brand);

    this.cardNumberElement?.update({ placeholder: preset.number });
    this.cardExpiryElement?.update({ placeholder: preset.expiry });
    this.cardCvcElement?.update({ placeholder: preset.cvc });

    if (clearValues) {
      this.cardNumberElement?.clear();
      this.cardExpiryElement?.clear();
      this.cardCvcElement?.clear();

      this.fieldState.number.complete = false;
      this.fieldState.number.error = null;
      this.fieldState.expiry.complete = false;
      this.fieldState.expiry.error = null;
      this.fieldState.cvc.complete = false;
      this.fieldState.cvc.error = null;
      this.errorMessage.set(null);
      this.complete.set(false);
      this.emitState();
    }
  }

  private destroyCardElements(): void {
    this.cardNumberElement?.destroy();
    this.cardExpiryElement?.destroy();
    this.cardCvcElement?.destroy();
    this.cardNumberElement = null;
    this.cardExpiryElement = null;
    this.cardCvcElement = null;
    this.elements = null;
    this.stripe = null;
    this.mounted = false;
    this.resetFieldState();

    if (this.mode === 'stripe') {
      this.ready.set(false);
      this.complete.set(false);
      this.errorMessage.set(null);
      this.emitState();
    }
  }

  private resetFieldState(): void {
    this.fieldState = {
      number: { ...INITIAL_FIELD_STATE.number },
      expiry: { ...INITIAL_FIELD_STATE.expiry },
      cvc: { ...INITIAL_FIELD_STATE.cvc },
    };
  }

  private getBrandPreset(brand: TestCardBrand): CardBrandPreset {
    return CARD_BRAND_PRESETS[brand];
  }

  private formatCardNumber(value: string, brand: TestCardBrand): string {
    const maxLength = brand === 'amex' ? 15 : 16;
    const digits = value.slice(0, maxLength);

    if (brand === 'amex') {
      const first = digits.slice(0, 4);
      const second = digits.slice(4, 10);
      const third = digits.slice(10, 15);
      return [first, second, third].filter(Boolean).join(' ');
    }

    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  private formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  private detectBrand(digits: string): TestCardBrand | null {
    if (/^3[47]/.test(digits)) {
      return 'amex';
    }

    if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) {
      return 'mastercard';
    }

    if (/^4/.test(digits)) {
      return 'visa';
    }

    return null;
  }

  private emitState(): void {
    this.paymentStateChange.emit({
      complete: this.complete(),
      ready: this.ready(),
      errorMessage: this.errorMessage(),
    });
  }

  private describeStripeError(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const candidate = error as {
      message?: string;
      code?: string;
      type?: string;
      decline_code?: string;
    };

    if (candidate.message?.trim()) {
      return candidate.message.trim();
    }

    const details = [candidate.code, candidate.type, candidate.decline_code].filter(
      (value): value is string => !!value?.trim(),
    );

    if (details.length) {
      return `${fallback} (${details.join(' / ')})`;
    }

    return fallback;
  }
}
