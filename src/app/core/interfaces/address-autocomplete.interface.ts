export interface AddressSuggestion {
  description: string;
  placeId: string;
  primaryText: string;
  secondaryText: string;
  resolvedAddress?: ResolvedAddress;
  metaLabel?: string;
  distanceMeters?: number | null;
  source?: 'search' | 'nearby';
}

export interface ResolvedAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  cp: string;
  formattedAddress: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
}
