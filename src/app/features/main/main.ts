import { Component, HostListener, afterNextRender, signal } from '@angular/core';

@Component({
  selector: 'app-main',
  standalone: true,
  templateUrl: './main.html',
})
export class Main {
  readonly hideFixedHero = signal(false);

  constructor() {
    afterNextRender(() => this.updateHeroVisibility());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateHeroVisibility();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateHeroVisibility();
  }

  private updateHeroVisibility(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const footerElement = document.querySelector('app-footer');
    const footerTop = footerElement?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
    this.hideFixedHero.set(footerTop <= window.innerHeight);
  }
}
