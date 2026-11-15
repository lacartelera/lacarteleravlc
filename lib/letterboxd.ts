import { load } from 'cheerio';
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
export function posterCandidates(title: string, suppliedYear?: number) {
  const quoted=title.match(/[«“]([^»”]+)[»”]/)?.[1];
  const clean=quoted || title.replace(/^.*?\s[–—]\s/,'').replace(/^(?:cine club(?: lys)?|proyecto viridiana|reestreno|preestreno)\s*[:–-]?\s*/i,'').replace(/\s+con\s+.+$/i,'').replace(/\s+en cines lys.*$/i,'').replace(/\((?:[^()]+,\s*)?\d{4}\)/g,'').trim();
  const aliases: Record<string,[string,number]> = {
    'en construccion':['work-in-progress-2001',2001], 'barrio':['barrio',1998],
    'el dia de la bestia':['the-day-of-the-beast',1995],
    'mujeres al borde de un ataque de nervios':['women-on-the-verge-of-a-nervous-breakdown',1988],
    'la caza':['the-hunt-1966',1966], 'viridiana':['viridiana',1961],
    'surcos':['furrows',1951], 'vida en sombras':['life-in-shadows',1948],
    'mamma mia':['mamma-mia',2008], 'terminator 2':['terminator-2-judgment-day',1991],
    'snatch cerdos y diamantes':['snatch',2000], 'atrapado en el tiempo':['groundhog-day',1993],
    'el silencio de los corderos':['the-silence-of-the-lambs',1991], 'la la land':['la-la-land',2016],
    'la invitacion':['the-invite-2026',2026], 'sentido y sensibilidad':['sense-and-sensibility-2026',2026],
    'besame tonto':['kiss-me-stupid',1964], 'te doy mis ojos':['take-my-eyes',2003],
    'estacion central':['cairo-station',1958], 'la mirada de ulises':['ulysses-gaze',1995],
    'paisaje en la niebla':['landscape-in-the-mist',1988], 'el espiritu de la colmena':['the-spirit-of-the-beehive',1973],
  };
  const alias=aliases[normalize(clean)],year=suppliedYear || alias?.[1],slug=normalize(clean).replaceAll(' ','-'),current=new Date().getUTCFullYear();
  return {title:clean,year,slugs:[...new Set([alias?.[0],...(year ? [`${slug}-${year}`,slug] : [slug,`${slug}-${current}`,`${slug}-${current-1}`])].filter(Boolean) as string[])]};
}
export function parseLetterboxdPoster(html: string, expectedYear?: number, director = '', expectedTitle = '') {
  const $=load(html);
  for(const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed=JSON.parse($(script).text().replace(/\/\*\s*(?:<!\[CDATA\[|\]\]>)\s*\*\//g,'').trim());
      const movies=Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for(const movie of movies) {
        if(movie['@type']!=='Movie') continue;
        const year=Number(String(movie.dateCreated || movie.datePublished || '').slice(0,4));
        if(!year || (expectedYear ? year!==expectedYear : !director && year<new Date().getUTCFullYear()-3)) continue;
        if(director) {
          const names=(Array.isArray(movie.director)?movie.director:[movie.director]).filter(Boolean).map((d:any)=>normalize(d.name || '')).join(' ');
          if(!director.split(/,| y /).map(normalize).some(name=>name && names.includes(name))) continue;
        }
        if(expectedTitle && !director){
          const titles=[movie.name,...[movie.alternateName || []].flat()].filter((value:any)=>typeof value==='string').map(normalize);
          if(!titles.includes(normalize(expectedTitle)))continue;
        }
        const url=typeof movie.image==='string' ? movie.image : movie.image?.url;
        if(typeof url==='string' && /^https:\/\/a\.ltrbxd\.com\/resized\/(?:film-poster|sm\/upload)\//.test(url)) return url;
      }
    } catch { /* A missing or malformed movie must not replace the correct poster. */ }
  }
  return null;
}

export function searchFilmSlugs(html:string) {
  const $=load(html), slugs=new Set<string>();
  $('[data-film-slug], [data-item-slug], a[href*="/film/"], [data-target-link*="/film/"]').each((_,el)=>{
    const node=$(el), direct=node.attr('data-film-slug') || node.attr('data-item-slug');
    const link=node.attr('href') || node.attr('data-target-link') || '';
    const slug=direct || link.match(/^\/film\/([^/?#]+)\/?$/)?.[1];
    if(slug && /^[a-z0-9-]+$/.test(slug))slugs.add(slug);
  });
  return [...slugs].slice(0,5);
}
