import { Component } from '@angular/core';
import { AdminProductManager } from '../components/product-manager/product-manager';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [AdminProductManager],
  templateUrl: './products.html',
})
export class AdminProducts {}
