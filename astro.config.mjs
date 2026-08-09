// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";

import cloudflare from '@astrojs/cloudflare';

import sitemap from '@astrojs/sitemap';
import { cinemas } from './src/data/cinemas.ts';

const site = 'https://kinoradar.pl';
const locales = ['pl', 'en'];
const seoPages = locales.flatMap((locale) => [
  `${site}/${locale}/`,
  ...cinemas.map((cinema) => `${site}/${locale}/kino/${cinema.slug}/`),
]);

// https://astro.build/config
export default defineConfig({
  site,
  output: 'server',
  integrations: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    sitemap({
      filter: (page) => page !== 'https://kinoradar.pl/' && !new URL(page).pathname.includes('/favorites'),
      customPages: seoPages,
      serialize: (item) => {
        const url = new URL(item.url);
        const suffix = url.pathname.replace(/^\/(pl|en)/, '');
        item.links = [
          { lang: 'pl', url: `${site}/pl${suffix}` },
          { lang: 'en', url: `${site}/en${suffix}` },
          { lang: 'x-default', url: `${site}/pl${suffix}` },
        ];
        return item;
      },
    }),
  ],

  i18n: {
    locales: ['pl', 'en'],
    defaultLocale: 'pl',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});
