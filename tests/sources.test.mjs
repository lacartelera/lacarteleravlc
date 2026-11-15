import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReserva,parseYelmo} from '../lib/commercial.ts';
import {parseUPV,parseUVDetail} from '../lib/cultural.ts';
import {cycleGroups,groupScreenings} from '../lib/presentation.js';
import {matches} from '../lib/filters.js';

test('ticket metadata supplies dates, exact venue and language across movie pages',()=>{
  const entries={101:{item_name:'Película',session_datetime:'2026-11-05T16:30',item_category4:'DIGITAL'},102:{item_name:'Película',session_datetime:'2026-11-06T19:00',item_category4:'VOSE'}};
  const html=`<script>window.reAnalyticsSesiones = ${JSON.stringify(entries)};</script><img class="media-object" src="https://abcpark.reservaentradas.com/poster.jpg"><a class="sesion" href="https://www.reservaentradas.com/entrada/valencia/abcpark/pelicula/101/?step=2">16:30</a><a class="sesion" href="https://www.reservaentradas.com/entrada/valencia/abcpark/pelicula/102/">19:00</a><a class="sesion" href="https://www.reservaentradas.com/entrada/valencia/abcpark/pelicula/103/">22:00</a>`;
  const sessions=parseReserva(html,'ABC Park','https://www.reservaentradas.com');
  assert.equal(sessions.length,2);assert.deepEqual(sessions.map(s=>s.date),['2026-11-05','2026-11-06']);assert.equal(sessions[1].vose,true);assert.equal(sessions[0].venue,'ABC Park');assert.match(sessions[0].poster,/abcpark/);
  assert.deepEqual(parseReserva('<a class="sesion">19:00</a>','ABC Park','https://www.reservaentradas.com'),[]);
});

test('Yelmo uses published cinema identity and dates, and excludes other branches',()=>{
  const day={FilterDate:`/Date(${Date.parse('2026-11-04T06:00:00Z')})/`,Movies:[{Title:'Película',ProjectionType:'Movie',Formats:[{Language:'INGLÉS SUBTITULADO EN ESPAÑOL (VOSE)',Showtimes:[{Time:'20:15',ShowtimeId:'123'}]}]}]};
  const sessions=parseYelmo({d:{Cinemas:[{Key:'mercado-de-campanar',VistaId:'811',Dates:[day]},{Key:'vidanova-parc',VistaId:'1059',Dates:[day]}]}});
  assert.equal(sessions.length,1);assert.equal(sessions[0].date,'2026-11-04');assert.equal(sessions[0].vose,true);assert.match(sessions[0].url,/cinemacode=811/);assert.equal(sessions[0].cycle,'');
});

test('UPV calendar preserves the explicit academic years and screening location',()=>{
  const html='<body><h1>Dijous de Pel·lícula</h1><p>18 h, Salón de Actos de Rectorado · Edificio 3A. Entrada libre hasta completar aforo. V.O. con subtítulos en castellano</p><h2>| 2026</h2><div><span>5 noviembre</span><span><em>En construcción</em></span></div><h2>| 2027</h2><div><span>14 enero</span><span><em>La caza</em></span></div></body>';
  const sessions=parseUPV(html,'https://www.upv.es/calendar');
  assert.deepEqual(sessions.map(s=>s.date),['2026-11-05','2027-01-14']);assert.equal(sessions[0].time,'18:00');assert.equal(sessions[0].free,true);assert.equal(sessions[0].cycle,'Dijous de Pel·lícula');assert.match(sessions[0].details,/Edificio 3A/);
});

test('named cycles replace generic categories and can be combined with a venue',()=>{
  const session={title:'Proyección',venue:'Cines Lys',date:'2026-11-05',time:'19:00',cycle:'Eventos · Proyecto Viridiana',cycles:['Aula de Cinema']};
  assert.deepEqual(cycleGroups(session),['Aula de Cinema','Proyecto Viridiana']);
  assert.equal(matches(session,{period:'month',venue:'Cines Lys',cycle:'Proyecto Viridiana',query:''},'2026-11-04'),true);
  assert.equal(matches(session,{period:'month',venue:'ABC Park',cycle:'Proyecto Viridiana',query:''},'2026-11-04'),false);
  assert.deepEqual(cycleGroups({...session,cycle:'Eventos',cycles:[],title:'Terroríficamente Lys: Película'}),['Terroríficamente Lys']);
  assert.deepEqual(cycleGroups({...session,cycle:'Ópera & Ballet',cycles:[]}),['Ópera & Ballet']);
  assert.deepEqual(cycleGroups({...session,cycle:'Eventos Especiales',cycles:[]}),[]);
  const groups=groupScreenings([session,{...session,time:'21:00',cycle:'Cine y terrorismo',cycles:[]}]);assert.ok(cycleGroups(groups[0]).includes('Cine y Terrorismo'));
});

test('a university general agenda does not turn concerts into cinema screenings',()=>{
  const html='<h1>Concierto</h1><div id="content">Concert de tardor</div><div id="sidebar">Data : 5 de novembre de 2026 de 19:00 a 21:00 Centre: Col·legi Major Rector Peset Sales: Sala Organitza: UV</div>';
  assert.deepEqual(parseUVDetail(html,'https://www.uv.es/event'),[]);
});
