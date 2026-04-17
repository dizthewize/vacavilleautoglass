import { SITE } from './site';

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoGlassShop',
    name: SITE.name,
    telephone: '+1-916-612-2126',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.addressLocality,
      addressRegion: SITE.addressRegion,
      addressCountry: SITE.addressCountry,
    },
    areaServed: SITE.areaServed,
    priceRange: SITE.priceRange,
    openingHours: SITE.openingHours,
    url: SITE.url,
    sameAs: [],
  };
}

export function serviceSchema(serviceName: string, description: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: serviceName,
    name: serviceName,
    description,
    url: `${SITE.url}/services/${slug}`,
    areaServed: SITE.areaServed,
    provider: {
      '@type': 'AutoGlassShop',
      name: SITE.name,
      telephone: '+1-916-612-2126',
      url: SITE.url,
    },
  };
}

export function cityLocalBusinessSchema(cityName: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoGlassShop',
    name: `${SITE.name} — ${cityName}`,
    telephone: '+1-916-612-2126',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.addressLocality,
      addressRegion: SITE.addressRegion,
      addressCountry: SITE.addressCountry,
    },
    areaServed: {
      '@type': 'City',
      name: cityName,
    },
    priceRange: SITE.priceRange,
    openingHours: SITE.openingHours,
    url: `${SITE.url}/service-areas/${slug}`,
  };
}

export function breadcrumbSchema(items: { label: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: `${SITE.url}${item.path}`,
    })),
  };
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}
