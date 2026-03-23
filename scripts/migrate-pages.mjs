import 'dotenv/config';

console.log('URL:', process.env.DATABASE_URL_UNPOOLED);

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const adapter = new PrismaPg({
  pg,
  connectionString: process.env.DATABASE_URL_UNPOOLED,
});

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

const pages = [
  {
    slug: 'home',
    label: 'Home',
    sections: [
      {
        type: 'hero',
        heading: 'Your <strong>residential landscaping</strong> experts',
        subheading: 'Custom outdoor spaces built to last.',
        buttonText: 'Get a Quote',
        buttonHref: '/contact',
        image: '/hero-placeholder.jpg',
      },
      {
        type: 'services',
        heading: 'Our <strong>services</strong>',
        services: [
          {
            title: 'Design & Installation',
            image: '/services-installation.jpg',
            href: '/landscape-design-installation',
          },
          {
            title: 'Maintenance',
            image: '/services-maintenance.jpg',
            href: '/landscape-maintenance',
          },
        ],
        bodyText:
          'From initial concept to long-term care, we provide full-service landscaping solutions tailored to your property.',
      },
      {
        type: 'banner',
        heading: 'Level Ground uses <strong>environmentally friendly</strong> products and techniques.',
        subheading: '',
        image: '/rain-barrel.jpeg',
        overlayOpacity: 0.45,
      },
    ],
  },
  {
    slug: 'landscape-design-installation',
    label: 'Installation',
    sections: [
      {
        type: 'hero',
        heading: 'Landscape Design & Installation',
        subheading: 'Custom, environmentally responsible outdoor spaces built to last.',
        buttonText: 'Request a Consultation',
        buttonHref: '/contact',
        image: '/images/landscape-hero.jpg',
      },
      {
        type: 'twoColumn',
        title: 'Design Built for Your Property',
        body: 'We create landscape designs that balance aesthetics, function, and long-term sustainability.',
        image: '/images/landscape-design.jpg',
      },
      {
        type: 'twoColumn',
        title: 'Professional Installation',
        body: 'Our team ensures your landscape is installed correctly and efficiently, using environmentally friendly practices.',
        image: '/images/landscape-installation.jpg',
      },
      {
        type: 'banner',
        heading: 'Environmentally responsible landscaping is at the heart of everything we do.',
        subheading: '',
        image: '/images/eco-landscape.jpg',
        overlayOpacity: 0.35,
      },
    ],
  },
  {
    slug: 'landscape-maintenance',
    label: 'Maintenance',
    sections: [
      {
        type: 'hero',
        heading: 'Landscape Maintenance Services',
        subheading: 'Keeping your outdoor spaces healthy, vibrant, and well-maintained.',
        buttonText: 'Get a Free Estimate',
        buttonHref: '/contact',
        image: '/images/maintenance-hero.jpg',
      },
      {
        type: 'banner',
        heading: 'Sustainable maintenance practices for a healthier, greener landscape.',
        subheading: '',
        image: '/images/sustainable-maintenance.jpg',
        overlayOpacity: 0.3,
      },
    ],
  },
];

async function migrate() {
  try {
    for (const p of pages) {
      console.log('Upserting', p.slug);
      await prisma.page.upsert({
        where: { slug: p.slug },
        create: { slug: p.slug, label: p.label, sections: p.sections },
        update: { label: p.label, sections: p.sections },
      });
    }

    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
