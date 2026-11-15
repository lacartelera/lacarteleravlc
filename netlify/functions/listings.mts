import { isValenciaSession } from '../../lib/geography.js';
import type { Session } from '../../lib/listings.ts';
import {commercialSources, collectReserva, collectYelmo} from '../../lib/commercial.ts';
import {parseStructured} from '../../lib/cultural.ts';
import { getStore } from '@netlify/blobs';
import { parsePosterCatalog, unifyPosters } from '../../lib/poster-catalog.ts';
import { madridDate, parseBabel, parseFilmoteca, parseLys, parseLysCartelera, mergeSessions } from '../../lib/listings.ts';
import { culturalSources, collectCultural, readPage } from '../../lib/cultural.ts';

export async function getListings(force=false) {
  const today=madridDate(), end=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))+1,0)).toISOString().slice(0,10);
  let store:ReturnType<typeof getStore> | undefined, previous:any;
  try{store=getStore('official-listings-cache');previous=await store.get('response-valencia-v3',{type:'json'});}catch{}
  if(!force && previous?.today===today && Date.now()-Date.parse(previous.fetchedAt)<300000)return previous;
  const sources:Array<{name:string;url:string;coverage:string;parse?:(body:string)=>Promise<Session[]>;collect?:()=>Promise<{sessions:Session[];partial?:boolean}>}>=[
    {name:'Cines Babel',url:'https://cinesbabel.com/cartelera/',coverage:'Cartelera semanal publicada por la sala.',parse:async(body:string)=>parseBabel(body,today)},
    {name:'Filmoteca Valenciana',url:'https://ivc.gva.es/es/audiovisuales/programacion/programacion-dias',coverage:'Sesiones y ciclos publicados para València.',parse:async(body:string)=>parseFilmoteca(body,today)},
    {name:'Cines Lys · ciclos',url:`https://cineslys.com/wp-json/tribe/events/v1/events?per_page=100&start_date=${today}&end_date=${end}`,coverage:'Eventos y ciclos, con paginación del calendario oficial.',parse:async(body:string)=>{
      let page=JSON.parse(body),sessions=parseLys(page);
      // The API supplies next_rest_url when another page exists.
      for(let i=0;page.next_rest_url && i<9;i++){
        const next=new URL(page.next_rest_url);if(next.origin!=='https://cineslys.com')break;
        page=JSON.parse(await readPage(next.href));sessions.push(...parseLys(page));
      }
      return sessions;
    }},
    {name:'Cines Lys',url:'https://www.reservaentradas.com/cine/valencia/cineslys',coverage:'Cartelera y horarios oficiales.',parse:async(body:string)=>parseLysCartelera(body,today)},
    ...commercialSources.map(source=>({...source,coverage:'Sesiones fechadas publicadas por la sala y su plataforma oficial de entradas.',collect:async()=>{
      if(source.kind==='yelmo')return {sessions:await collectYelmo()};
      const deadline=Date.now()+16000;
      const body=await readPage(source.url);
      return source.kind==='reserva'?collectReserva(body,source.name,source.url,deadline):{sessions:parseStructured(body,source.url,source.name)};
    }})),
    ...culturalSources.map(source=>({...source,parse:async(body:string)=>source.kind==='filmoteca'?parseFilmoteca(body,today).map(s=>({...s,venue:'Filmoteca d’Estiu'})):collectCultural(source,body)})),
  ];
  const results=await Promise.all(sources.map(async source=>{
    try{
      const body=source.collect?'':await readPage(source.url);
      const collection=source.collect?await source.collect():{sessions:await source.parse!(body),partial:false};
      const sessions=collection.sessions.filter(s=>s.date>=today && isValenciaSession(s));
      return {sessions,posters:source.url.includes('reservaentradas.com/cine/')?parsePosterCatalog(body):[],source:{name:source.name,url:source.url,coverage:source.coverage,available:true,partial:collection.partial || false,fetchedAt:new Date().toISOString(),sessionCount:sessions.length}};
    }catch{
      const old=previous?.sources?.find((s:any)=>s.name===source.name);
      const recent=old?.fetchedAt && Date.now()-Date.parse(old.fetchedAt)<86400000;
      return {sessions:recent?(previous.sessions || []).filter((s:any)=>s.sourceName===source.name):[],posters:[],source:{name:source.name,url:source.url,coverage:source.coverage,available:false,fetchedAt:old?.fetchedAt || null,cached:Boolean(recent)}};
    }
  }));
  const sessions=mergeSessions(unifyPosters(results.flatMap(r=>r.sessions.map(s=>({...s,sourceName:r.source.name}))),results.flatMap(r=>r.posters))).filter(s=>s.date>=today && isValenciaSession(s)).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const payload={today,fetchedAt:new Date().toISOString(),sessions,sources:results.map(r=>r.source)};
  // Cache the API response; failed sources retain their original verification timestamp.
  if(results.some(r=>r.source.available))try{await store?.setJSON('response-valencia-v3',payload);}catch{}
  return payload;
}
export default async()=>{
  const payload=await getListings();
  return Response.json(payload,{status:payload.sources.every((s:any)=>!s.available)&&!payload.sessions.length?503:200,headers:{'Cache-Control':'public, max-age=30, s-maxage=60'}});
};
