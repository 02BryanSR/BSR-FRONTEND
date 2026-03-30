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

const CATEGORY_SLUG: CategorySlug = 'women';

@Component({
  selector: 'app-women',
  standalone: true,
  imports: [CategoryShowcaseComponent],
  templateUrl: './women.html',
})
export class Women {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogService = inject(CatalogService);

  readonly showcaseState = toSignal(
    createCategoryShowcaseState(this.catalogService, this.route, CATEGORY_SLUG),
    { initialValue: createInitialCategoryShowcaseState(CATEGORY_SLUG) },
  );
}
