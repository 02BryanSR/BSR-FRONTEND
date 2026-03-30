import {
  type CatalogCategory,
  type CatalogProduct,
  type CategorySlug,
} from '../../core/interfaces/catalog.interface';
import { type CategoryShowcaseImage, type CategoryShowcasePanel } from './category-showcase';

export interface CategoryShowcaseContent {
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  heroImage: string;
  heroAlt: string;
  highlights: readonly string[];
  panels: readonly CategoryShowcasePanel[];
  gallery: readonly CategoryShowcaseImage[];
  products: readonly CatalogProduct[];
}

const PRICE_FORMATTER = new Intl.NumberFormat('es-ES', {
  currency: 'EUR',
  style: 'currency',
  maximumFractionDigits: 2,
});

const FALLBACK_CATEGORY_CONTENT: Record<CategorySlug, CategoryShowcaseContent> = {
  women: {
    eyebrow: 'Collection',
    title: 'Women',
    description:
      'A modern women category with clean silhouettes, polished layering and an editorial direction built for elevated everyday styling.',
    accent: 'Premium edit',
    heroImage: '/images/home-1-2.jpg',
    heroAlt: 'Women category hero',
    highlights: ['Light tailoring', 'Satin textures', 'Evening layers'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'New essentials',
        description:
          'A refined mix of clean silhouettes and versatile staples designed for everyday dressing with a sharper point of view.',
      },
      {
        eyebrow: 'Capsule',
        title: 'After dark',
        description:
          'Fluid dresses, subtle shine and structured shapes ready to support a stronger evening fashion story.',
      },
      {
        eyebrow: 'Focus',
        title: 'Weekend reset',
        description:
          'Relaxed pieces with a premium edge, ideal for editorial blocks, featured collections and future product grids.',
      },
    ],
    gallery: [
      {
        src: '/images/home-1-2.jpg',
        alt: 'Women collection hero look',
        caption: 'Main edit',
      },
      {
        src: '/images/home-3-2.jpg',
        alt: 'Women collection editorial look',
        caption: 'Fluid silhouettes',
      },
      {
        src: '/images/home-4-1.jpg',
        alt: 'Women collection premium details',
        caption: 'Premium details',
      },
    ],
    products: [],
  },
  men: {
    eyebrow: 'Collection',
    title: 'Men',
    description:
      'A men category built around urban layering, confident denim and sharp essentials with an editorial fashion attitude.',
    accent: 'Core selection',
    heroImage: '/images/home-1-1.jpg',
    heroAlt: 'Men category hero',
    highlights: ['Premium denim', 'Urban layering', 'Deep neutrals'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'Street tailoring',
        description:
          'A layout designed for relaxed tailoring, wider silhouettes and elevated basics with a stronger urban identity.',
      },
      {
        eyebrow: 'Capsule',
        title: 'Core layers',
        description:
          'Sweatshirts, jackets and midweight essentials ready to support featured drops and category storytelling.',
      },
      {
        eyebrow: 'Focus',
        title: 'Weekend uniform',
        description:
          'Versatile looks built for future product cards, editorial sections and strong campaign highlights.',
      },
    ],
    gallery: [
      {
        src: '/images/home-1-1.jpg',
        alt: 'Men collection hero look',
        caption: 'Core menswear',
      },
      {
        src: '/images/home-2-1.jpg',
        alt: 'Men collection layered look',
        caption: 'Layered denim',
      },
      {
        src: '/images/home2-3.jpg',
        alt: 'Men collection streetwear look',
        caption: 'Street essentials',
      },
    ],
    products: [],
  },
  boys: {
    eyebrow: 'Collection',
    title: 'Ni\u00F1os',
    description:
      'A boys category ready for comfortable layering, active silhouettes and a clear structure for everyday essentials.',
    accent: 'Daily energy',
    heroImage: '/images/home-4-3.jpg',
    heroAlt: 'Boys category hero',
    highlights: ['Easy sets', 'Active color', 'Daily movement'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'Play all day',
        description:
          'A fresh structure for colorful looks, comfortable fits and a more energetic browsing experience across the category.',
      },
      {
        eyebrow: 'Capsule',
        title: 'Mini icons',
        description:
          'Ideal for hero pieces, new drops and styled combinations that make this section feel playful and modern.',
      },
      {
        eyebrow: 'Focus',
        title: 'Ready to move',
        description:
          'Prepared for future catalog cards, promo banners and a complete shopping flow with a stronger visual identity.',
      },
    ],
    gallery: [
      {
        src: '/images/home-4-2.jpg',
        alt: 'Boys collection movement look',
        caption: 'Movement first',
      },
      {
        src: '/images/home-4-3.jpg',
        alt: 'Boys collection colorful look',
        caption: 'Color layers',
      },
      {
        src: '/images/home-4-4.jpg',
        alt: 'Boys collection daily set',
        caption: 'Daily sets',
      },
    ],
    products: [],
  },
  girls: {
    eyebrow: 'Collection',
    title: 'Ni\u00F1as',
    description:
      'A girls category built for playful styling, easy combinations and a softer editorial rhythm across the full section.',
    accent: 'Daily energy',
    heroImage: '/images/home-4-2.jpg',
    heroAlt: 'Girls category hero',
    highlights: ['Light layers', 'Playful sets', 'Daily movement'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'Play all day',
        description:
          'A fresh structure for colorful looks, comfortable fits and a more energetic browsing experience across the category.',
      },
      {
        eyebrow: 'Capsule',
        title: 'Mini icons',
        description:
          'Ideal for hero pieces, new drops and styled combinations that make this section feel playful and modern.',
      },
      {
        eyebrow: 'Focus',
        title: 'Ready to move',
        description:
          'Prepared for future catalog cards, promo banners and a complete shopping flow with a stronger visual identity.',
      },
    ],
    gallery: [
      {
        src: '/images/home-4-2.jpg',
        alt: 'Girls collection movement look',
        caption: 'Movement first',
      },
      {
        src: '/images/home-4-3.jpg',
        alt: 'Girls collection colorful look',
        caption: 'Color layers',
      },
      {
        src: '/images/home-4-4.jpg',
        alt: 'Girls collection daily set',
        caption: 'Daily sets',
      },
    ],
    products: [],
  },
  kids: {
    eyebrow: 'Collection',
    title: 'Kids',
    description:
      'A kids category ready for playful color, easy outfits and an energetic layout that still feels aligned with the main brand.',
    accent: 'Daily energy',
    heroImage: '/images/home-4-3.jpg',
    heroAlt: 'Kids category hero',
    highlights: ['Easy sets', 'Active color', 'Daily movement'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'Play all day',
        description:
          'A fresh structure for colorful looks, comfortable fits and a more energetic browsing experience across the category.',
      },
      {
        eyebrow: 'Capsule',
        title: 'Mini icons',
        description:
          'Ideal for hero pieces, new drops and styled combinations that make the kids section feel playful and modern.',
      },
      {
        eyebrow: 'Focus',
        title: 'Ready to move',
        description:
          'Prepared for future catalog cards, promo banners and a complete kids shopping flow with a stronger visual identity.',
      },
    ],
    gallery: [
      {
        src: '/images/home-4-2.jpg',
        alt: 'Kids collection movement look',
        caption: 'Movement first',
      },
      {
        src: '/images/home-4-3.jpg',
        alt: 'Kids collection colorful look',
        caption: 'Color layers',
      },
      {
        src: '/images/home-4-4.jpg',
        alt: 'Kids collection daily set',
        caption: 'Daily sets',
      },
    ],
    products: [],
  },
  accessories: {
    eyebrow: 'Collection',
    title: 'Accessories',
    description:
      'An editorial accessories category built to highlight statement pieces, texture and the final details that complete every look.',
    accent: 'Key pieces',
    heroImage: '/images/home-5.jpg',
    heroAlt: 'Accessories category hero',
    highlights: ['Statement bags', 'Mixed textures', 'Final details'],
    panels: [
      {
        eyebrow: 'Edit',
        title: 'Finish the look',
        description:
          'A strong visual base for bags, eyewear, belts and jewelry that completes the styling story across the store.',
      },
      {
        eyebrow: 'Capsule',
        title: 'Statement pieces',
        description:
          'Designed to support hero accessories, seasonal highlights and quick-purchase products with more visual impact.',
      },
      {
        eyebrow: 'Focus',
        title: 'Daily essentials',
        description:
          'Ready to expand with filters, featured blocks and a richer catalog experience for accessories.',
      },
    ],
    gallery: [
      {
        src: '/images/home-5.jpg',
        alt: 'Accessories collection hero look',
        caption: 'Statement accents',
      },
      {
        src: '/images/home-2-2.jpg',
        alt: 'Accessories collection textured look',
        caption: 'Texture focus',
      },
      {
        src: '/images/home2-4.jpg',
        alt: 'Accessories collection final styling details',
        caption: 'Final details',
      },
    ],
    products: [],
  },
};

export function buildCategoryShowcaseContent(
  slug: CategorySlug,
  category: CatalogCategory | null,
  products: readonly CatalogProduct[],
): CategoryShowcaseContent {
  const fallback = FALLBACK_CATEGORY_CONTENT[slug];
  const categoryName = category?.name?.trim() || fallback.title;
  const productHighlights = products
    .map((product) => product.name.trim())
    .filter((productName) => !!productName)
    .slice(0, 3);
  const productsWithImages = products.filter((product) => !!product.imageUrl).slice(0, 3);
  const priceValues = products
    .map((product) => product.price)
    .filter((price): price is number => typeof price === 'number');
  const priceRange = buildPriceRange(priceValues);

  return {
    eyebrow: fallback.eyebrow,
    title: categoryName,
    description: category?.description?.trim() || fallback.description,
    accent: buildCategoryAccent(slug),
    heroImage: category?.imageUrl ?? productsWithImages[0]?.imageUrl ?? fallback.heroImage,
    heroAlt: category ? `${categoryName} category hero` : fallback.heroAlt,
    highlights: products.length
      ? [
          `${products.length} productos`,
          categoryName,
          priceRange,
        ]
      : fallback.highlights,
    panels: fallback.panels,
    gallery: buildGallery(categoryName, productsWithImages, fallback.gallery),
    products,
  };
}

function buildGallery(
  categoryName: string,
  productsWithImages: readonly CatalogProduct[],
  fallbackGallery: readonly CategoryShowcaseImage[],
): readonly CategoryShowcaseImage[] {
  if (!productsWithImages.length) {
    return fallbackGallery;
  }

  const backendGallery = productsWithImages.map((product) => ({
    src: product.imageUrl!,
    alt: `${categoryName} ${product.name}`,
    caption: buildProductCaption(product),
  }));

  return [...backendGallery, ...fallbackGallery.slice(backendGallery.length)].slice(0, 3);
}

function buildProductCaption(product: CatalogProduct): string {
  if (typeof product.price !== 'number') {
    return product.name;
  }

  return `${product.name} - ${PRICE_FORMATTER.format(product.price)}`;
}

function buildPriceRange(prices: readonly number[]): string {
  if (!prices.length) {
    return 'Sin precios';
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return PRICE_FORMATTER.format(minPrice);
  }

  return `${PRICE_FORMATTER.format(minPrice)} - ${PRICE_FORMATTER.format(maxPrice)}`;
}

function buildCategoryAccent(slug: CategorySlug): string {
  switch (slug) {
    case 'women':
      return 'Catalogo para mujeres';
    case 'men':
      return 'Catalogo para hombres';
    case 'boys':
      return 'Catalogo para ni\u00F1os';
    case 'girls':
      return 'Catalogo para ni\u00F1as';
    case 'kids':
      return 'Catalogo infantil';
    case 'accessories':
      return 'Catalogo para accesorios';
  }
}
