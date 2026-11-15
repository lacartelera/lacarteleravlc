import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matches} from '../lib/filters.js';
import {cycleGroup} from '../lib/presentation.js';
import {parseUVDetail,parseStructured,isFree} from '../lib/cultural.ts';
const session={title:'Película',venue:'La Nau',date:'2026-11-05',time:'19:00',cycle:'Cine y terrorismo',rerelease:true};
test('free filter requires affirmative evidence',()=>{
 const state={period:'month',query:'',free:true};
 assert.equal(matches(session,state,'2026-11-04'),false);
 assert.equal(matches({...session,free:true},state,'2026-11-04'),true);
 assert.equal(matches({...session,free:true,date:'2026-10-01'},state,'2026-11-04'),false);
});
test('cycles remain visible for repertory films',()=>{
 assert.equal(cycleGroup(session),'Cine y Terrorismo');
 assert.equal(cycleGroup({...session,cycle:'Billy Wilder'}),'Billy Wilder');
 assert.equal(cycleGroup({...session,venue:'Cines Lys',cycle:'Cine Club Lys'}),'');
});
test('UV dates, time, city venue and free entry',()=>{
 const html='<h1>A toda máquina</h1><p>Cicle Autoria. Centre Cultural La Nau</p><p>Entrada lliure, aforament limitat</p><p>Data : 5 de novembre de 2026 de 19:00 a 21:00 Centre: Centre Cultural La Nau Sales: Aula Magna Organitza: Aula de Cinema UV</p>';
 const [s]=parseUVDetail(html,'https://www.uv.es/event');
 assert.equal(s.date,'2026-11-05');assert.equal(s.time,'19:00');assert.equal(s.free,true);
 assert.equal(parseUVDetail(html.replaceAll('Centre Cultural La Nau','Centre Internacional de Gandia'),'https://www.uv.es/event').length,0);
});
test('structured cinema events exclude cancellation and other cities',()=>{
 const event={'@type':'ScreeningEvent',name:'Película',startDate:'2026-07-14T22:00:00+02:00',isAccessibleForFree:true,location:{name:'Claustre',address:{addressLocality:'València'}}};
 const html=e=>`<script type="application/ld+json">${JSON.stringify(e)}</script>`;
 assert.equal(parseStructured(html(event),'https://www.uv.es/','UV')[0].free,true);
 assert.equal(parseStructured(html({...event,eventStatus:'https://schema.org/EventCancelled'}),'https://www.uv.es/','UV').length,0);
 assert.equal(parseStructured(html({...event,location:{address:{addressLocality:'Alcoi'}}}),'https://www.uv.es/','UV').length,0);
 assert.equal(isFree('entrada de pago'),false);
});
