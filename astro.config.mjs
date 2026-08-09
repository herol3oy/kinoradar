// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";

import cloudflare from '@astrojs/cloudflare';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://kinoradar.pl',
  output: 'server',
  integrations: [
    react(),
    sitemap({
      filter: (page) => page !== 'https://kinoradar.pl/',
      serialize: (item) => {
        item.links = [
          { lang: 'pl', url: 'https://kinoradar.pl/pl/' },
          { lang: 'en', url: 'https://kinoradar.pl/en/' },
          { lang: 'x-default', url: 'https://kinoradar.pl/pl/' },
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
      redirectToDefaultLocale: true,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});
