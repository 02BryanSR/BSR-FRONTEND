import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  apiBaseUrl: 'http://localhost:8080',
  stripe: {
    publishableKey:
      'pk_test_51TIEscFjMIDwXhorSzLooiMBdFfPeqFA5jJjalKQzEvPOiUOg3Ek2a2cFzBUV6McFm38PgTavknbnHlkRSKbRTyO00JNnyOSx4',
    checkoutMode: 'demo',
  },
  geoapify: {
    apiKey: 'e7b1688accf34937a2e7deb37dd8a434',
    region: 'ES',
    language: 'es',
  },
};
