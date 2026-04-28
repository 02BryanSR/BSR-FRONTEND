export type CheckoutMode = 'demo' | 'stripe';

export interface AppEnvironment {
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
}
