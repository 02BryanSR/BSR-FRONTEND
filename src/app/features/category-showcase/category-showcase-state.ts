import { ActivatedRoute } from '@angular/router';
import { combineLatest, map, of, switchMap, type Observable } from 'rxjs';
import {
  filterProductsBySubcategory,
  normalizeCategorySubcategory,
} from '../../core/constants/category-subcategories.constants';
import {
  type CatalogSubcategorySlug,
  type CategorySlug,
} from '../../core/interfaces/catalog.interface';
import { CatalogService } from '../../core/services/catalog.service';
import { buildCategoryShowcaseContent, type CategoryShowcaseContent } from './category-showcase-content';

export interface CategoryShowcaseState {
  content: CategoryShowcaseContent;
  selectedSubcategory: CatalogSubcategorySlug;
}

export function createInitialCategoryShowcaseState(slug: CategorySlug): CategoryShowcaseState {
  return {
    content: buildCategoryShowcaseContent(slug, null, []),
    selectedSubcategory: 'all',
  };
}

export function createCategoryShowcaseState(
  catalogService: CatalogService,
  route: ActivatedRoute,
  slug: CategorySlug,
): Observable<CategoryShowcaseState> {
  return combineLatest([catalogService.getCategoryBySlug(slug), route.queryParamMap]).pipe(
    switchMap(([category, queryParamMap]) => {
      const selectedSubcategory = normalizeCategorySubcategory(queryParamMap.get('subcategoria'));

      if (!category) {
        return of({
          content: buildCategoryShowcaseContent(slug, null, []),
          selectedSubcategory,
        });
      }

      return catalogService.getProductsByCategoryId(category.id).pipe(
        map((products) => ({
          content: buildCategoryShowcaseContent(
            slug,
            category,
            filterProductsBySubcategory(products, selectedSubcategory),
          ),
          selectedSubcategory,
        })),
      );
    }),
  );
}
