import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const pages = [
  // copy of pages from src/lib/mockPages.ts
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

async function upsertPage(client, p) {
  const query = `INSERT INTO pages (slug, label, sections, createdat, updatedat) VALUES ($1, $2, $3::jsonb, now(), now()) ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, sections = EXCLUDED.sections, updatedat = now()`;
  await client.query(query, [p.slug, p.label, JSON.stringify(p.sections)]);
}

async function run() {
  const client = await pool.connect();
  try {
    for (const p of pages) {
      console.log('Upserting', p.slug);
      await upsertPage(client, p);
    }
    console.log('Done.');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
