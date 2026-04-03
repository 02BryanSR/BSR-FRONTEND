import { Injectable } from '@angular/core';
import {
  ADDRESS_LOOKUP_API_KEY,
  ADDRESS_LOOKUP_LANGUAGE,
  ADDRESS_LOOKUP_REGION,
} from '../constants/api.constants';
import {
  AddressSuggestion,
  ResolvedAddress,
} from '../interfaces/address-autocomplete.interface';

type GeoapifyResult = {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  county?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  formatted?: string;
  place_id?: string;
  street?: string;
  housenumber?: string;
  lat?: number | string;
  lon?: number | string;
  distance?: number | string;
  result_type?: string;
  name?: string;
};

@Injectable({ providedIn: 'root' })
export class AddressLookupService {
  private readonly preferredNearbyRadiusMeters = 120;
  private readonly fallbackNearbyRadiusMeters = 250;

  isConfigured(): boolean {
    return !!ADDRESS_LOOKUP_API_KEY;
  }

  async searchAddresses(
    query: string,
    countryCode = ADDRESS_LOOKUP_REGION,
  ): Promise<AddressSuggestion[]> {
    const normalizedQuery = query.trim();

    if (!this.isConfigured() || normalizedQuery.length < 3) {
      return [];
    }

    const params = new URLSearchParams({
      text: normalizedQuery,
      format: 'json',
      lang: ADDRESS_LOOKUP_LANGUAGE,
      limit: '5',
      apiKey: ADDRESS_LOOKUP_API_KEY,
    });

    if (countryCode.trim()) {
      params.set('filter', `countrycode:${countryCode.toLowerCase()}`);
    }

    const payload = await this.requestJson<{ results?: GeoapifyResult[] }>(
      `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
    );

    const results = Array.isArray(payload?.results) ? payload.results : [];

    return results
      .map((result) => {
        const resolvedAddress = this.toResolvedAddress(result);

        return {
          description: result.formatted?.trim() || resolvedAddress.formattedAddress,
          placeId: result.place_id?.toString().trim() || resolvedAddress.placeId,
          primaryText: result.address_line1?.trim() || resolvedAddress.address,
          secondaryText:
            result.address_line2?.trim() ||
            [resolvedAddress.cp, resolvedAddress.city, resolvedAddress.country]
              .filter(Boolean)
              .join(', '),
          resolvedAddress,
          source: 'search',
        } satisfies AddressSuggestion;
      })
      .filter((result) => !!result.placeId || !!result.description);
  }

  async resolveSuggestion(placeId: string): Promise<ResolvedAddress | null> {
    if (!this.isConfigured() || !placeId.trim()) {
      return null;
    }

    const params = new URLSearchParams({
      format: 'json',
      lang: ADDRESS_LOOKUP_LANGUAGE,
      filter: `place:${placeId}`,
      apiKey: ADDRESS_LOOKUP_API_KEY,
    });

    const payload = await this.requestJson<{ results?: GeoapifyResult[] }>(
      `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
    );

    const result = Array.isArray(payload?.results) ? payload.results[0] : null;
    return result ? this.toResolvedAddress(result) : null;
  }

  async useCurrentLocation(countryCode = ADDRESS_LOOKUP_REGION): Promise<ResolvedAddress | null> {
    const position = await this.getCurrentPosition().catch(() => null);

    if (!position) {
      return null;
    }

    return await this.reverseGeocode(position.coords.latitude, position.coords.longitude, countryCode);
  }

  async getNearbyAddressesFromCurrentLocation(
    countryCode = ADDRESS_LOOKUP_REGION,
  ): Promise<AddressSuggestion[]> {
    const position = await this.getCurrentPosition().catch(() => null);

    if (!position) {
      return [];
    }

    return await this.getNearbyAddresses(
      position.coords.latitude,
      position.coords.longitude,
      countryCode,
    );
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
    countryCode = ADDRESS_LOOKUP_REGION,
  ): Promise<ResolvedAddress | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      lang: ADDRESS_LOOKUP_LANGUAGE,
      apiKey: ADDRESS_LOOKUP_API_KEY,
    });

    if (countryCode.trim()) {
      params.set('filter', `countrycode:${countryCode.toLowerCase()}`);
    }

    const payload = await this.requestJson<{ results?: GeoapifyResult[] }>(
      `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`,
    );

    const result = Array.isArray(payload?.results) ? payload.results[0] : null;
    return result ? this.toResolvedAddress(result) : null;
  }

  private async getNearbyAddresses(
    latitude: number,
    longitude: number,
    countryCode = ADDRESS_LOOKUP_REGION,
  ): Promise<AddressSuggestion[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      lang: ADDRESS_LOOKUP_LANGUAGE,
      limit: '8',
      apiKey: ADDRESS_LOOKUP_API_KEY,
    });

    if (countryCode.trim()) {
      params.set('filter', `countrycode:${countryCode.toLowerCase()}`);
    }

    const payload = await this.requestJson<{ results?: GeoapifyResult[] }>(
      `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`,
    );

    const results = Array.isArray(payload?.results) ? payload.results : [];
    const seen = new Set<string>();
    const suggestions = results
      .map((result) => this.toNearbySuggestion(result))
      .filter((suggestion): suggestion is AddressSuggestion => !!suggestion)
      .filter((suggestion) => {
        const key = `${suggestion.primaryText}|${suggestion.secondaryText}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

    const streetLevelSuggestions = suggestions.filter((suggestion) => this.isStreetLevelSuggestion(suggestion));
    const preciseStreetSuggestions = streetLevelSuggestions.filter((suggestion) =>
      this.isWithinRadius(suggestion.distanceMeters, this.preferredNearbyRadiusMeters),
    );
    const fallbackStreetSuggestions = streetLevelSuggestions.filter((suggestion) =>
      this.isWithinRadius(suggestion.distanceMeters, this.fallbackNearbyRadiusMeters),
    );
    const preciseAnySuggestions = suggestions.filter((suggestion) =>
      this.isWithinRadius(suggestion.distanceMeters, this.preferredNearbyRadiusMeters),
    );

    return (
      preciseStreetSuggestions.length
        ? preciseStreetSuggestions
        : fallbackStreetSuggestions.length
          ? fallbackStreetSuggestions
          : preciseAnySuggestions.length
            ? preciseAnySuggestions
            : streetLevelSuggestions.length
              ? streetLevelSuggestions
              : suggestions
    ).slice(0, 5);
  }

  private async requestJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  private async getCurrentPosition(): Promise<GeolocationPosition> {
    return await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation no disponible'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  private toResolvedAddress(source: GeoapifyResult): ResolvedAddress {
    const baseAddress =
      source.address_line1?.trim() ||
      [source.street?.trim(), source.housenumber?.trim()].filter(Boolean).join(' ').trim() ||
      source.formatted?.trim() ||
      '';

    return {
      address: baseAddress,
      city: source.city?.trim() || source.town?.trim() || source.village?.trim() || source.suburb?.trim() || '',
      state: source.state?.trim() || source.county?.trim() || '',
      country: source.country?.trim() || '',
      countryCode: source.country_code?.trim().toUpperCase() || '',
      cp: source.postcode?.trim() || '',
      formattedAddress: source.formatted?.trim() || baseAddress,
      placeId: source.place_id?.toString().trim() || '',
      latitude: this.toNullableNumber(source.lat),
      longitude: this.toNullableNumber(source.lon),
    };
  }

  private toNearbySuggestion(source: GeoapifyResult): AddressSuggestion | null {
    const resolvedAddress = this.toResolvedAddress(source);
    const primaryText = this.toStreetAddressLabel(source, resolvedAddress);
    const placeId = source.place_id?.toString().trim() || resolvedAddress.placeId;

    if (!primaryText || !placeId) {
      return null;
    }

    return {
      description: source.formatted?.trim() || resolvedAddress.formattedAddress,
      placeId,
      primaryText,
      secondaryText: [resolvedAddress.cp, resolvedAddress.city, resolvedAddress.country]
        .filter(Boolean)
        .join(', '),
      resolvedAddress,
      distanceMeters: this.toNullableNumber(source.distance),
      metaLabel: this.toDistanceLabel(source.distance),
      source: 'nearby',
    };
  }

  private isWithinRadius(distance: number | null | undefined, maxDistanceMeters: number): boolean {
    return typeof distance === 'number' && Number.isFinite(distance) && distance <= maxDistanceMeters;
  }

  private isStreetLevelSuggestion(suggestion: AddressSuggestion): boolean {
    const address = suggestion.resolvedAddress?.address?.trim() || '';

    if (!address) {
      return false;
    }

    return /\d/.test(address) || /calle|avenida|avda|paseo|plaza|camino|carretera|ronda|via|gran via/i.test(address);
  }

  private toStreetAddressLabel(source: GeoapifyResult, resolvedAddress: ResolvedAddress): string {
    const streetAddress = [source.street?.trim(), source.housenumber?.trim()].filter(Boolean).join(' ').trim();

    if (streetAddress) {
      return streetAddress;
    }

    if (resolvedAddress.address?.trim() && !this.looksLikePoiName(source, resolvedAddress.address)) {
      return resolvedAddress.address.trim();
    }

    return source.address_line1?.trim() || resolvedAddress.formattedAddress;
  }

  private looksLikePoiName(source: GeoapifyResult, value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();
    const normalizedName = source.name?.trim().toLowerCase() || '';
    const resultType = source.result_type?.trim().toLowerCase() || '';

    if (!normalizedValue) {
      return false;
    }

    if (resultType === 'amenity' && normalizedName && normalizedValue === normalizedName) {
      return true;
    }

    return false;
  }

  private toDistanceLabel(value: number | string | undefined): string | undefined {
    const distance = this.toNullableNumber(value);

    if (distance === null) {
      return undefined;
    }

    if (distance < 1000) {
      return `A ${Math.round(distance)} m`;
    }

    return `A ${(distance / 1000).toFixed(1).replace('.', ',')} km`;
  }

  private toNullableNumber(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
