import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface CategoryShowcasePanel {
  eyebrow: string;
  title: string;
  description: string;
}

export interface CategoryShowcaseImage {
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-category-showcase',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './category-showcase.html',
})
export class CategoryShowcaseComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly accent = input.required<string>();
  readonly heroImage = input.required<string>();
  readonly heroAlt = input.required<string>();
  readonly highlights = input.required<readonly string[]>();
  readonly panels = input.required<readonly CategoryShowcasePanel[]>();
  readonly gallery = input.required<readonly CategoryShowcaseImage[]>();
}
