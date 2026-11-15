import { venues } from './venues.js';

// Keep the requested metropolitan cinemas, while excluding other provincial programmes.
export function isValenciaSession(session) {
  const location=[session.venue,session.city].filter(Boolean).join(' ');
  if(/alicante|alacant|arniches|castell[oó]|alco[yi]|benic[aà]ssim/i.test(location)) return false;
  if(session.city) return /^(?:val[eè]ncia|xirivella|alfafar|aldaia)$/i.test(session.city.trim());
  return venues.some(venue=>venue.name===session.venue);
}
