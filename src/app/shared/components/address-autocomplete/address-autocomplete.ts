import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { ADDRESS_LOOKUP_REGION } from '../../../core/constants/api.constants';
import {
  AddressSuggestion,
  ResolvedAddress,
} from '../../../core/interfaces/address-autocomplete.interface';
import { AddressLookupService } from '../../../core/services/address-lookup.service';

@Component({
  selector: 'app-address-autocomplete',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './address-autocomplete.html',
})
export class AddressAutocompleteComponent implements OnChanges, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly addressLookupService = inject(AddressLookupService);

  @Input() value = '';
  @Input() placeholder = 'Calle Gran Via 25';
  @Input() country = ADDRESS_LOOKUP_REGION;

  @Output() valueChange = new EventEmitter<string>();
  @Output() addressResolved = new EventEmitter<ResolvedAddress>();

  readonly query = signal('');
  readonly suggestions = signal<readonly AddressSuggestion[]>([]);
  readonly loading = signal(false);
  readonly locating = signal(false);
  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  readonly feedbackMessage = signal<string | null>(null);
  readonly showingNearbyOptions = signal(false);
  readonly lookupConfigured = this.addressLookupService.isConfigured();

  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.query.set(this.value || '');
    }
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }
  }

  onQueryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextValue = input.value;

    this.query.set(nextValue);
    this.valueChange.emit(nextValue);
    this.feedbackMessage.set(null);
    this.activeIndex.set(-1);
    this.showingNearbyOptions.set(false);

    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }

    if (!this.lookupConfigured) {
      this.feedbackMessage.set(
        'Anade tu API key de Geoapify en src/environments/environment.ts para activar las sugerencias de direccion.',
      );
      this.suggestions.set([]);
      this.open.set(false);
      this.loading.set(false);
      return;
    }

    if (nextValue.trim().length < 3) {
      this.suggestions.set([]);
      this.open.set(false);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.searchDebounceId = setTimeout(async () => {
      const suggestions = await this.addressLookupService.searchAddresses(nextValue, this.country);

      this.suggestions.set(suggestions);
      this.open.set(suggestions.length > 0);
      this.loading.set(false);
    }, 280);
  }

  async useCurrentLocation(): Promise<void> {
    if (!this.lookupConfigured) {
      this.feedbackMessage.set('Anade tu API key de Geoapify para activar la ubicacion automatica.');
      return;
    }

    this.locating.set(true);
    this.feedbackMessage.set(null);

    const suggestions = await this.addressLookupService
      .getNearbyAddressesFromCurrentLocation(this.country)
      .catch(() => []);

    this.locating.set(false);

    if (!suggestions.length) {
      this.showingNearbyOptions.set(false);
      this.feedbackMessage.set(
        'No se pudieron encontrar direcciones cercanas. Puedes escribirla manualmente.',
      );
      return;
    }

    this.suggestions.set(suggestions);
    this.open.set(true);
    this.activeIndex.set(0);
    this.showingNearbyOptions.set(true);
    this.feedbackMessage.set('Selecciona la direccion mas cercana o sigue escribiendo para ajustarla.');
  }

  async selectSuggestion(suggestion: AddressSuggestion): Promise<void> {
    const resolved =
      suggestion.resolvedAddress ||
      (await this.addressLookupService.resolveSuggestion(suggestion.placeId));

    if (!resolved) {
      this.feedbackMessage.set('No se pudo completar esa direccion. Intenta con otra sugerencia.');
      return;
    }

    this.applyResolvedAddress(resolved);
  }

  onInputFocus(): void {
    if (this.suggestions().length > 0) {
      this.open.set(true);
    }
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (!this.open() || !this.suggestions().length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((index) => Math.min(index + 1, this.suggestions().length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const index = this.activeIndex();

      if (index >= 0) {
        event.preventDefault();
        void this.selectSuggestion(this.suggestions()[index]);
      }
      return;
    }

    if (event.key === 'Escape') {
      this.open.set(false);
      this.activeIndex.set(-1);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.activeIndex.set(-1);
    }
  }

  private applyResolvedAddress(resolved: ResolvedAddress): void {
    const nextValue = resolved.address || resolved.formattedAddress;

    this.query.set(nextValue);
    this.valueChange.emit(nextValue);
    this.addressResolved.emit(resolved);
    this.suggestions.set([]);
    this.open.set(false);
    this.activeIndex.set(-1);
    this.showingNearbyOptions.set(false);
    this.feedbackMessage.set(null);
  }
}
