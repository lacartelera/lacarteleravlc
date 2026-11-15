import { load } from 'cheerio';
import type { Session } from './listings.ts';

type FilmPoster = { key: string; poster: string; decorated: boolean };

function filmKey(title: string) {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/^(?:proyecto viridiana|cine club lys|terrorificamente lys|preestreno|reestreno)\b[\s,:–-]*/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}

function ticketTitle(url = '') {
  try {
    return decodeURIComponent(new URL(url).pathname.match(/\/(?:sesiones|entrada)\/valencia\/cineslys\/([^/]+)/)?.[1] || '').replaceAll('-',' ');
  } catch { return ''; }
}

// Includes the forthcoming films: they have artwork even before daily times are published.
export function parsePosterCatalog(html: string): FilmPoster[] {
  const $=load(html), catalog: FilmPoster[]=[];
  $('a[href*="/sesiones/valencia/cineslys/"] img').each((_,node)=>{
    const image=$(node), title=ticketTitle(image.closest('a').attr('href'));
    const poster=image.attr('data-original') || image.attr('src') || '';
    if (!title || !/^https:\/\/cineslys\.reservaentradas\.com\//.test(poster)) return;
    catalog.push({key:filmKey(title),poster,decorated:/^(?:proyecto viridiana|cine club lys|terrorificamente lys)\b/.test(title)});
  });
  return catalog;
}

export function unifyPosters(sessions: Session[], catalog: FilmPoster[]) {
  return sessions.map(session=>{
    // Match the publisher's film slug, rather than guessing from a long event headline.
    const title=ticketTitle(session.posterPage || session.url);
    const key=filmKey(title || session.title);
    const matches=catalog.filter(item=>item.key===key).sort((a,b)=>Number(a.decorated)-Number(b.decorated));
    if (!matches.length) return session;
    const posters=[...new Set([...matches.map(item=>item.poster),session.poster,...(session.posters || [])].filter(Boolean))] as string[];
    return {...session,poster:posters[0],posters};
  });
}
