import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  security: {
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    react({
      include: ['**/admin/**', '**/components/admin/**'],
    }),
    tailwind(),
  ],
  server: {
    host: true,
    port: Number(process.env.PORT) || 4322,
  },
});
