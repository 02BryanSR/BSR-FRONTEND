import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CATEGORY_SUBCATEGORY_OPTIONS,
  buildSubcategoryQueryParams,
  type CategorySubcategoryOption,
} from '../../../core/constants/category-subcategories.constants';
import { type CatalogSubcategorySlug } from '../../../core/interfaces/catalog.interface';

@Component({
  selector: 'app-category-subcategory-nav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './category-subcategory-nav.html',
})
export class CategorySubcategoryNavComponent {
  readonly route = input.required<string>();
  readonly label = input('Subcategorías');
  readonly selectedSubcategory = input<CatalogSubcategorySlug>('all');
  readonly options = input<readonly CategorySubcategoryOption[]>(CATEGORY_SUBCATEGORY_OPTIONS);

  getQueryParams(subcategory: CatalogSubcategorySlug): Record<string, string> {
    return buildSubcategoryQueryParams(subcategory);
  }
}
