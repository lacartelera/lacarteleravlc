import { load } from 'cheerio';
import { displayName } from './presentation.js';
import type { Session } from './listings.ts';
import { readPage } from './cultural.ts';

export const commercialSources = [
  {name:'ABC Park',url:'https://www.reservaentradas.com/cine/valencia/abcpark',kind:'reserva'},
  {name:'ABC Gran Turia',url:'https://www.reservaentradas.com/cine/valencia/abcgranturia',kind:'reserva'},
  {name:'ABC El Saler',url:'https://www.reservaentradas.com/cine/valencia/abcelsaler',kind:'reserva'},
  {name:'Cinestudio d’Or',url:'https://www.reservaentradas.com/cine/valencia/cinestudiodor',kind:'reserva'},
  {name:'MN4',url:'https://www.reservaentradas.com/cine/alfafar/cinesmn4',kind:'reserva'},
  {name:'Yelmo Mercado de Campanar',url:'https://yelmocines.es/cartelera/valencia/mercado-de-campanar',kind:'yelmo'},
  {name:'Cinesa Bonaire',url:'https://www.cinesa.es/cines/bonaire/',kind:'structured'},
  {name:'Cinesa Camí Real',url:'https://www.cinesa.es/cines/cami-real/',kind:'structured'},
];
export function parseReserva(html:string, venue:string, base:string):Session[] {
  const $=load(html), sessions:Session[]=[];
  const scripts=$('script').map((_,el)=>$(el).text()).get().join('\n');
  const match=scripts.match(/window\.reAnalyticsSesiones\s*=\s*(\{[^;]+\});/);
  if(!match)return [];
  const entries=JSON.parse(match[1]);
  $('a.sesion[href]').each((_,el)=>{
    const node=$(el), href=node.attr('href') || '';
    const id=href.includes('/entrada/')?href.match(/\/(\d+)\/(?:\?|$)/)?.[1]:undefined;
    const entry=id?entries[id]:undefined;
    if(!entry || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/.test(entry.session_datetime || ''))return;
    const movie=node.closest('.movie');
    const img=movie.find('.caratula-cine img').first();
    const poster=img.attr('data-original') || img.attr('src') || $('img.media-object').first().attr('src');
    const title=displayName(entry.item_name || movie.find('.title-movie-list a').first().text());
    if(!title)return;
    sessions.push({id:`${entry.location_id || venue}-${id}`,title,venue,date:entry.session_datetime.slice(0,10),time:entry.session_datetime.slice(11,16),url:new URL(href,base).href,poster:poster?new URL(poster,base).href:undefined,vose:/VOSE|SUBTITUL/i.test(entry.item_category4 || ''),cycle:'',festival:false,details:entry.item_category4 || '',rerelease:/reestreno|restaurad|cl[aá]sic/i.test(title)});
  });
  return sessions;
}
export async function collectReserva(html:string,venue:string,base:string,deadline=Date.now()+16000){
  const $=load(html), pages=new Set<string>();
  const cinemaSlug=new URL(base).pathname.split('/').filter(Boolean).at(-1);
  $('a.sesion[href*="/sesiones/"]').each((_,el)=>{
    const url=new URL($(el).attr('href')!,base);
    if(url.origin==='https://www.reservaentradas.com' && url.pathname.startsWith('/sesiones/') && url.pathname.split('/')[3]===cinemaSlug)pages.add(url.href);
  });
  const sessions=parseReserva(html,venue,base);
  // Bounded batches avoid flooding the ticket provider; all movie detail pages are dated.
  const links=[...pages].slice(0,100);
  let failed=0;
  let completed=0;
  for(let i=0;i<links.length && Date.now()<deadline;i+=4){
    const results=await Promise.all(links.slice(i,i+4).map(async url=>{
      try{return parseReserva(await readPage(url),venue,url);}catch{failed++;return [];}
    }));
    sessions.push(...results.flat());completed+=results.length;
  }
  if(!sessions.length)throw new Error('No dated showtimes available');
  return {sessions,partial:failed>0 || pages.size>completed};
}
export function parseYelmo(payload:any):Session[]{
  const data=typeof payload.d==='string'?JSON.parse(payload.d):payload.d;
  if(!Array.isArray(data?.Cinemas))throw new Error('Invalid Yelmo response');
  const sessions:Session[]=[];
  for(const cinema of data.Cinemas){
    if(cinema.Key!=='mercado-de-campanar')continue;
    for(const day of cinema.Dates || [])for(const movie of day.Movies || [])for(const format of movie.Formats || [])for(const time of format.Showtimes || []){
      const stamp=String(day.FilterDate || '').match(/\/Date\((\d+)/)?.[1];
      const date=stamp?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(stamp))):'';
      if(!date || !/^\d{2}:\d{2}$/.test(time.Time) || !movie.Title)continue;
      const url=new URL('https://inetvis.yelmocines.es/compra/visSelectTickets.aspx');
      url.searchParams.set('cinemacode',cinema.VistaId);url.searchParams.set('txtSessionId',time.ShowtimeId);
      sessions.push({id:`yelmo-${cinema.VistaId}-${time.ShowtimeId}`,title:displayName(movie.Title),venue:'Yelmo Mercado de Campanar',date,time:time.Time,url:url.href,poster:movie.Poster,cycle:movie.ProjectionType && !/^movie$/i.test(movie.ProjectionType)?movie.ProjectionType:'',vose:/VOSE|SUBTITUL/i.test(format.Language),festival:false,details:[movie.Director,format.Language,movie.RunTime?movie.RunTime+' min':''].filter(Boolean).join(' · ')});
    }
  }
  return sessions;
}
export async function collectYelmo(){
  const response=await fetch('https://yelmocines.es/now-playing.aspx/GetNowPlaying',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:'{"cityKey": "valencia"}',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Yelmo unavailable');
  return parseYelmo(await response.json());
}
