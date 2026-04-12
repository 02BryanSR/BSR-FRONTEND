export type CheckoutMode = 'demo' | 'stripe';

export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;
  stripe: {
    publishableKey: string;
    checkoutMode: CheckoutMode;
  };
  geoapify: {
    apiKey: string;
    region: string;
    language: string;
  };
  resend: {
    enabled: boolean;
    senderEmail: string;
  };
}
