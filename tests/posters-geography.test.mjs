import {test} from 'node:test';
import assert from 'node:assert/strict';
import {posterSources} from '../lib/posters.js';
import {parseLetterboxdPoster,posterCandidates,searchFilmSlugs} from '../lib/letterboxd.ts';
import letterboxdPoster from '../netlify/functions/letterboxd-poster.mts';
import {parseFilmoteca} from '../lib/listings.ts';
import {isValenciaSession} from '../lib/geography.js';

const image='https://a.ltrbxd.com/resized/film-poster/test.jpg';
const page=(year=2001,director='José Luis Guerin',name='Work in Progress')=>`<script type="application/ld+json">${JSON.stringify({'@type':'Movie',name,datePublished:String(year),director:{name:director},image})}</script>`;
test('official images precede Letterboxd, whose title and credits are separated',()=>{
 const sources=posterSources({title:'A toda máquina (Ismael Rodríguez, 1951)',venue:'Centre Cultural La Nau',poster:'https://www.uv.es/image.jpg'});
 assert.match(sources[0].url,/cinema-poster/);assert.equal(sources[1].url,'https://www.uv.es/image.jpg');
 const fallback=new URL(sources[2].url,'https://example.test');assert.equal(fallback.searchParams.get('title'),'A toda máquina');assert.equal(fallback.searchParams.get('year'),'1951');assert.equal(fallback.searchParams.get('director'),'Ismael Rodríguez');
 assert.equal(new URL(sources.at(-1).url,'https://example.test').searchParams.get('original'),'1');
 const missing=posterSources({title:'En construcción',venue:'Universitat Politècnica de València',year:2001,director:'José Luis Guerin'});
 assert.match(missing[0].url,/letterboxd-poster/);assert.ok(missing[0].url.includes('year=2001'));
});
test('translated film lookup validates the year and director',()=>{
 assert.equal(posterCandidates('En construcción',2001).slugs[0],'work-in-progress-2001');
 assert.equal(parseLetterboxdPoster(page(),2001,'José Luis Guerin'),image);
 assert.equal(parseLetterboxdPoster(page(),1999,'José Luis Guerin'),null);
 assert.equal(parseLetterboxdPoster(page(),2001,'Otra persona'),null);
 assert.equal(parseLetterboxdPoster(page(),2001,'','Un título distinto'),null);
 assert.deepEqual(searchFilmSlugs('<div data-film-slug="work-in-progress-2001"></div><a href="/film/work-in-progress-2001/">Film</a><a href="https://other.test/film/unrelated/">Other</a>'),['work-in-progress-2001']);
});
test('Letterboxd delivery has a direct image fallback after the CDN',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(page());
 try{
  const optimized=await letterboxdPoster(new Request('https://example.test/?title=En+construcci%C3%B3n&year=2001&director=Jos%C3%A9+Luis+Guerin'));
  assert.equal(optimized.status,302);assert.match(optimized.headers.get('location'),/^\/\.netlify\/images\?/);
  const direct=await letterboxdPoster(new Request('https://example.test/?title=En+construcci%C3%B3n&year=2001&director=Jos%C3%A9+Luis+Guerin&original=1'));
  assert.equal(direct.headers.get('location'),image);
 }finally{globalThis.fetch=originalFetch;}
});
test('a Letterboxd block stops further attempts without substituting another film',async()=>{
 const originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 try{const response=await letterboxdPoster(new Request('https://example.test/?title=En+construccion&year=2001'));assert.equal(response.status,404);assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
});
test('provincial venues are excluded even from cached results, without matching film titles',()=>{
 assert.equal(isValenciaSession({venue:'Filmoteca d’Alacant (Arniches)'}),false);
 assert.equal(isValenciaSession({venue:'Filmoteca de Castellón'}),false);
 assert.equal(isValenciaSession({venue:'Otro espacio',city:'Alacant'}),false);
 assert.equal(isValenciaSession({venue:'Cines Lys',title:'Un viaje a Alicante'}),true);
 assert.equal(isValenciaSession({venue:'ABC Gran Turia'}),true);
 const event=city=>`<div class="actividad"><span class="lugar">${city}</span><span class="mes">nov</span><span class="dia">5</span><span class="hora">19:00</span><h2>Película</h2></div>`;
 const sessions=parseFilmoteca(event('València')+event('Alacant')+event('Castellón'),'2026-11-04');assert.equal(sessions.length,1);assert.equal(sessions[0].venue,'Filmoteca de València (Rialto)');
});
