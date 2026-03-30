import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { type CategorySlug } from '../../core/interfaces/catalog.interface';
import { CatalogService } from '../../core/services/catalog.service';
import { CategoryShowcaseComponent } from '../category-showcase/category-showcase';
import {
  createCategoryShowcaseState,
  createInitialCategoryShowcaseState,
} from '../category-showcase/category-showcase-state';

const CATEGORY_SLUG: CategorySlug = 'men';

@Component({
  selector: 'app-men',
  standalone: true,
  imports: [CategoryShowcaseComponent],
  templateUrl: './men.html',
})
export class Men {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogService = inject(CatalogService);

  readonly showcaseState = toSignal(
    createCategoryShowcaseState(this.catalogService, this.route, CATEGORY_SLUG),
    { initialValue: createInitialCategoryShowcaseState(CATEGORY_SLUG) },
  );
}
