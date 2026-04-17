export const SITE = {
  name: 'Vacaville Auto Glass',
  phone: '(916) 612-2126',
  phoneHref: 'tel:+19166122126',
  url: 'https://vacavilleautoglass.com',
  email: '',
  hours: 'Mon–Sat 8am–6pm · Sun by appointment',
  openingHours: 'Mo-Sa 08:00-18:00',
  addressLocality: 'Vacaville',
  addressRegion: 'CA',
  addressCountry: 'US',
  priceRange: '$$',
  areaServed: [
    'Vacaville, CA',
    'Fairfield, CA',
    'Dixon, CA',
    'Davis, CA',
    'Winters, CA',
    'Suisun City, CA',
    'Vallejo, CA',
    'Napa, CA',
    'Woodland, CA',
  ],
  allCities: [
    'Vacaville',
    'Fairfield',
    'Dixon',
    'Davis',
    'Winters',
    'Suisun City',
    'Vallejo',
    'Napa',
    'Woodland',
    'Cordelia',
    'Elmira',
    'Allendale',
    'American Canyon',
  ],
};

export interface ServiceMeta {
  slug: string;
  name: string;
  benefit: string;
  schemaServiceType: string;
}

export const SERVICES: ServiceMeta[] = [
  {
    slug: 'windshield-replacement',
    name: 'Windshield Replacement',
    benefit: 'OEM-quality glass, mobile install, lifetime warranty.',
    schemaServiceType: 'Windshield Replacement',
  },
  {
    slug: 'windshield-repair',
    name: 'Windshield Repair',
    benefit: 'Rock chip & crack repair in 30 minutes — often $0 with insurance.',
    schemaServiceType: 'Windshield Repair',
  },
  {
    slug: 'side-window-replacement',
    name: 'Side Window Replacement',
    benefit: 'Door glass replacement with full shard cleanup.',
    schemaServiceType: 'Side Window Replacement',
  },
  {
    slug: 'rear-window-replacement',
    name: 'Rear Window Replacement',
    benefit: 'Back glass replacement with defroster grid preserved.',
    schemaServiceType: 'Rear Window Replacement',
  },
  {
    slug: 'adas-calibration',
    name: 'ADAS Calibration',
    benefit: 'Factory-certified camera recalibration after windshield work.',
    schemaServiceType: 'ADAS Calibration',
  },
  {
    slug: 'mobile-service',
    name: 'Mobile Service',
    benefit: 'We come to you — home, office, or roadside, no trip fee.',
    schemaServiceType: 'Mobile Auto Glass Service',
  },
];

export interface CityMeta {
  slug: string;
  name: string;
  landmark: string;
  neighbors: string;
}

export const CITIES: CityMeta[] = [
  {
    slug: 'vacaville',
    name: 'Vacaville',
    landmark: 'Whether you\'re near the Nut Tree Plaza, Vacaville Premium Outlets, or off Alamo Drive, we\'ll come to you.',
    neighbors: 'Fairfield, Dixon, Winters, Elmira',
  },
  {
    slug: 'fairfield',
    name: 'Fairfield',
    landmark: 'Whether you\'re near Travis AFB, the Solano Mall, or downtown Fairfield, we\'ll come to you.',
    neighbors: 'Vacaville, Suisun City, Cordelia',
  },
  {
    slug: 'dixon',
    name: 'Dixon',
    landmark: 'From downtown Dixon to the farmland edges off Pitt School Road, we show up same-day when you call early.',
    neighbors: 'Vacaville, Davis, Winters',
  },
  {
    slug: 'davis',
    name: 'Davis',
    landmark: 'Whether you\'re at UC Davis, in South Davis, or off Covell Boulevard, we\'ll meet you at your car.',
    neighbors: 'Dixon, Woodland, Winters',
  },
  {
    slug: 'vallejo',
    name: 'Vallejo',
    landmark: 'From the Mare Island waterfront to Glen Cove and Hiddenbrooke, we cover every Vallejo neighborhood.',
    neighbors: 'Napa, American Canyon, Fairfield',
  },
  {
    slug: 'napa',
    name: 'Napa',
    landmark: 'From downtown Napa to the vineyards out on Silverado Trail, we\'ll handle your glass on-site.',
    neighbors: 'American Canyon, Vallejo, Fairfield',
  },
];

// NOTE: Testimonial names are placeholders. Replace with real, verifiable customer
// attributions before launch — using fabricated names on a live service-business
// site can be misleading under FTC endorsement guidelines.
export const TESTIMONIALS = [
  {
    quote: 'They came to my office in Fairfield, replaced the windshield in under an hour, and handled my insurance claim without me lifting a finger. Unbeatable.',
    name: '[Customer Name]',
    city: 'Fairfield',
    service: 'Windshield Replacement',
  },
  {
    quote: 'Rock chip turned into a crack overnight. They fixed it in my driveway the next morning. Insurance covered everything. Friendly, fast, professional.',
    name: '[Customer Name]',
    city: 'Vacaville',
    service: 'Chip Repair',
  },
  {
    quote: 'My 2023 truck needed ADAS recalibration after the new windshield. They did it right the first time — lane-assist works perfectly. Highly recommend.',
    name: '[Customer Name]',
    city: 'Davis',
    service: 'Windshield + ADAS',
  },
];

export const HOMEPAGE_FAQS = [
  {
    question: 'Is mobile auto glass service really free?',
    answer: 'Yes. We charge the same rate whether you come to our shop or we come to you — within our 20-mile Vacaville service area. No trip fees, no surprise charges.',
  },
  {
    question: 'Will my insurance cover the windshield replacement?',
    answer: 'In most cases, yes. Comprehensive coverage typically covers full windshield replacement (often with a deductible). Rock chip repair is frequently covered with no deductible under California law. We bill your insurance directly — all you do is call.',
  },
  {
    question: 'How long does a windshield replacement take?',
    answer: 'About 60 minutes to install, plus a 60-minute safe-drive-away time for the urethane adhesive to cure. Total appointment: roughly 2 hours. Chip repairs take 30 minutes or less.',
  },
  {
    question: 'My car has lane-assist and cameras. Do I need ADAS calibration?',
    answer: 'Yes. Any vehicle with a forward-facing windshield camera (lane departure, collision warning, adaptive cruise) requires recalibration after a windshield replacement. We\'re ADAS-certified and perform calibration on-site.',
  },
  {
    question: 'Do you work on all makes and models?',
    answer: 'Yes. We carry OEM and OEM-equivalent glass for virtually every passenger vehicle, light truck, and SUV. Exotic, classic, or fleet vehicle? Call us — we can source it.',
  },
  {
    question: 'What if I just have a small chip — should I repair or replace?',
    answer: 'If the chip is smaller than a quarter and not in the driver\'s direct sightline, repair is almost always better: cheaper, faster, and often free with insurance. If the crack is longer than 3 inches or spreading, replacement is the safer call.',
  },
  {
    question: 'Do you offer a warranty?',
    answer: 'Every installation carries a lifetime warranty against air leaks, water leaks, and workmanship defects, for as long as you own the vehicle.',
  },
  {
    question: 'Do you service commercial fleets?',
    answer: 'Yes. We handle fleet accounts with consolidated invoicing and priority scheduling. Call (916) 612-2126 to set up an account.',
  },
];

export const INSURANCE_CARRIERS = [
  'State Farm',
  'GEICO',
  'Progressive',
  'Allstate',
  'Farmers',
  'AAA',
  'USAA',
  'Liberty Mutual',
  'Mercury',
  'Nationwide',
  'Travelers',
  'The Hartford',
  'Kemper',
];
