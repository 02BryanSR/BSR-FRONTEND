(function configureApp() {
  const browserHostname = window.location.hostname?.trim() || 'localhost';
  const resolvedApiHost = browserHostname || 'localhost';

  window.__APP_CONFIG__ = {
    apiBaseUrl: `http://${resolvedApiHost}:8080`,
    stripePublishableKey:
      'pk_test_51TIEscFjMIDwXhorSzLooiMBdFfPeqFA5jJjalKQzEvPOiUOg3Ek2a2cFzBUV6McFm38PgTavknbnHlkRSKbRTyO00JNnyOSx4',
    cardCheckoutMode: 'demo',
    geoapifyApiKey: 'e7b1688accf34937a2e7deb37dd8a434',
    geoapifyRegion: 'ES',
    geoapifyLanguage: 'es',
  };
})();
