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

type TestCardBrand = 'visa' | 'mastercard' | 'amex';
type CardFieldKey = 'number' | 'expiry' | 'cvc';

type CardFieldState = {
  complete: boolean;
  error: string | null;
  ready: boolean;
};

const INITIAL_FIELD_STATE: Record<CardFieldKey, CardFieldState> = {
  number: { complete: false, error: null, ready: false },
  expiry: { complete: false, error: null, ready: false },
  cvc: { complete: false, error: null, ready: false },
};

@Component({
  selector: 'app-stripe-payment-element',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-payment-element.html',
})
export class StripePaymentElementComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) clientSecret = '';
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
  readonly selectedBrand = signal<TestCardBrand | null>(null);

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
    await this.mountCardElements();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['clientSecret'] && this.viewReady) {
      await this.mountCardElements();
    }
  }

  ngOnDestroy(): void {
    this.destroyCardElements();
  }

  async confirmPayment(_returnUrl?: string): Promise<{ success: boolean; errorMessage?: string }> {
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
    this.cardNumberElement?.focus();
  }

  private async mountCardElements(): Promise<void> {
    const clientSecret = this.clientSecret.trim();
    const numberHost = this.cardNumberHost?.nativeElement;
    const expiryHost = this.cardExpiryHost?.nativeElement;
    const cvcHost = this.cardCvcHost?.nativeElement;

    if (!this.viewReady || !clientSecret || !numberHost || !expiryHost || !cvcHost || this.mounted) {
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
        placeholder: '1234 1234 1234 1234',
        showIcon: false,
        style: {
          base: baseStyle,
          invalid: invalidStyle,
        },
      });

      this.cardExpiryElement = this.elements.create('cardExpiry', {
        placeholder: 'MM / AA',
        style: {
          base: baseStyle,
          invalid: invalidStyle,
        },
      });

      this.cardCvcElement = this.elements.create('cardCvc', {
        placeholder: 'CVC',
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

      if (event.empty) {
        this.selectedBrand.set(null);
      } else if (event.brand === 'visa' || event.brand === 'mastercard' || event.brand === 'amex') {
        this.selectedBrand.set(event.brand);
      }

      this.syncFieldState();
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
      this.syncFieldState();
    });
  }

  private registerCardCvcEvents(element: StripeCardCvcElement): void {
    element.on('ready', () => {
      this.markFieldReady('cvc');
    });

    element.on('change', (event) => {
      this.fieldState.cvc.complete = !!event.complete;
      this.fieldState.cvc.error = event.error?.message ?? null;
      this.syncFieldState();
    });
  }

  private markFieldReady(field: CardFieldKey): void {
    this.fieldState[field].ready = true;
    this.syncFieldState();
  }

  private syncFieldState(): void {
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

  private destroyCardElements(): void {
    this.cardNumberElement?.destroy();
    this.cardExpiryElement?.destroy();
    this.cardCvcElement?.destroy();
    this.cardNumberElement = null;
    this.cardExpiryElement = null;
    this.cardCvcElement = null;
    this.elements = null;
    this.mounted = false;
    this.resetFieldState();
    this.ready.set(false);
    this.complete.set(false);
    this.selectedBrand.set(null);
    this.emitState();
  }

  private resetFieldState(): void {
    this.fieldState = {
      number: { ...INITIAL_FIELD_STATE.number },
      expiry: { ...INITIAL_FIELD_STATE.expiry },
      cvc: { ...INITIAL_FIELD_STATE.cvc },
    };
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
