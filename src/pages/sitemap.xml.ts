// Plan du site pour les moteurs de recherche (pages publiques uniquement).
import type { APIRoute } from 'astro';

const PAGES = ['', 'recherche/', 'marche/', 'opportunites/', 'scanner/', 'defi/', 'collection/', 'favoris/', 'classement/', 'compte/', 'mentions-legales/', 'confidentialite/'];

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((p) => `  <url><loc>${new URL(base + p, site).href}</loc><lastmod>${today}</lastmod></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
