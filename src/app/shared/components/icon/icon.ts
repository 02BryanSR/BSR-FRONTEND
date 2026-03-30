import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg class="w-full h-full" aria-hidden="true">
      <use [attr.href]="'/icons/sprite.svg#' + name()"></use>
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }

      :host(:not([class])) {
        width: 1.25rem;
        height: 1.25rem;
      }
    `,
  ],
})
export class IconComponent {
  name = input.required<string>();
}
