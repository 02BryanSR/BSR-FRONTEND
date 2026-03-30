import { Component, computed, input } from '@angular/core';

export type SurfaceCardTone = 'white' | 'panel' | 'media';
export type SurfaceCardPadding = 'none' | 'md' | 'lg' | 'xl';
export type SurfaceCardRadius = 'md' | 'lg';

@Component({
  selector: 'app-surface-card',
  standalone: true,
  templateUrl: './surface-card.html',
  host: {
    class: 'block',
  },
})
export class SurfaceCardComponent {
  readonly tone = input<SurfaceCardTone>('white');
  readonly padding = input<SurfaceCardPadding>('md');
  readonly radius = input<SurfaceCardRadius>('lg');
  readonly dashed = input(false);
  readonly shadow = input(true);
  readonly overflowHidden = input(false);
  readonly extraClasses = input('');

  readonly cardClasses = computed(() => {
    const toneClasses: Record<SurfaceCardTone, string> = {
      white: 'bg-white',
      panel: 'bg-surface-panel',
      media: 'bg-surface-media',
    };

    const paddingClasses: Record<SurfaceCardPadding, string> = {
      none: '',
      md: 'p-5 md:p-6',
      lg: 'p-6',
      xl: 'px-6 py-10',
    };

    const radiusClasses: Record<SurfaceCardRadius, string> = {
      md: 'rounded-[1.6rem]',
      lg: 'rounded-[2rem]',
    };

    const borderClasses = this.dashed()
      ? 'border border-dashed border-black/15'
      : 'border border-black/10';

    const optionalClasses = [
      this.shadow() ? 'shadow-[0_20px_50px_rgba(15,23,42,0.06)]' : '',
      this.overflowHidden() ? 'overflow-hidden' : '',
      this.extraClasses().trim(),
    ]
      .filter(Boolean)
      .join(' ');

    return [
      radiusClasses[this.radius()],
      borderClasses,
      toneClasses[this.tone()],
      paddingClasses[this.padding()],
      optionalClasses,
    ]
      .filter(Boolean)
      .join(' ');
  });
}
