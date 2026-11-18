import { framePoster, posterSources } from './lib/posters.js';
import { addDays, matches } from './lib/filters.js';
import { venues } from './lib/venues.js';
import { isValenciaSession } from './lib/geography.js';
import { cycleGroups, groupScreenings } from './lib/presentation.js';
const $ = selector => document.querySelector(selector);
const state = { period: 'today', day: '', venue: '', vose: false, free: false, rerelease: false, kind: '', cycle: '', query: '' };
let data;
const dateLabel = date => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).format(new Date(`${date}T12:00:00Z`));
function element(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
function toggle(button, active) { button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
function safeLink(anchor, url) { try { const parsed = new URL(url); if (['https:','http:'].includes(parsed.protocol)) anchor.href = parsed.href; } catch {} anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
function reset() { Object.assign(state, {day:'',venue:'',vose:false,free:false,rerelease:false,kind:'',cycle:'',query:''}); $('#search').value = ''; render(); }
function renderVenueOptions() {
  const select=$('#venue-filter');select.replaceChildren(element('option','Todos los espacios'));
  select.firstElementChild.value='';
  const names=[...new Set([...venues.map(v=>v.name),...(data?.sessions || []).map(s=>s.venue)])].sort((a,b)=>a.localeCompare(b,'es'));
  for(const name of names){const option=element('option',name);option.value=name;select.append(option);}
  select.value=state.venue;
}
renderVenueOptions();
function render() {
  document.querySelectorAll('[data-period]').forEach(b => toggle(b, b.dataset.period === state.period));
  document.querySelectorAll('[data-filter]').forEach(button => toggle(button, button.dataset.filter === 'all' ? !state.vose && !state.free && !state.rerelease : button.dataset.filter === 'vose' ? state.vose : button.dataset.filter === 'free' ? state.free : state.rerelease));
  $('#venue-filter').value=state.venue;$('#venue-filter').classList.toggle('active',Boolean(state.venue));
  if (!data) return;
  data.today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  $('#agenda-title').textContent = { today:'Agenda de hoy',week:'Próximos 7 días',month:'Agenda de este mes' }[state.period];
  const days = $('#days'); days.replaceChildren();
  if (state.period !== 'today') {
    const dates = [];
    for (let day = data.today; state.period === 'week' ? day <= addDays(data.today,6) : day.slice(0,7) === data.today.slice(0,7); day = addDays(day,1)) dates.push(day);
    for (const day of ['', ...dates]) {
      const b = element('button', day ? dateLabel(day) : 'Todos los días');
      if (day) b.append(element('small', new Intl.DateTimeFormat('es-ES',{weekday:'short',timeZone:'Europe/Madrid'}).format(new Date(`${day}T12:00:00Z`))));
      toggle(b, state.day === day); b.onclick = () => { state.day = day; render(); }; days.append(b);
    }
  }
  const sessions = data.sessions.filter(s => matches(s,state,data.today));
  const groups = groupScreenings(sessions);
  $('#count').textContent = `${new Set(sessions.map(s=>s.title)).size} películas · ${sessions.length} sesiones${state.cycle ? ` · ${state.cycle}` : ''}`;
  const list = $('#listings'); list.replaceChildren();
  if (!sessions.length) { const empty = element('div', '', 'empty'); empty.append(element('h3','No hay sesiones publicadas con estos filtros.'),element('p',state.venue && !data.sources.some(source=>source.name===state.venue && source.available) ? 'Los horarios de esta sala todavía no están integrados. Consulta su cartelera oficial.' : 'Prueba otro día o limpia los filtros. Las salas pueden publicar su programación más adelante.')); if(state.venue) { const venue=venues.find(v=>v.name===state.venue) || {url:data.sources.find(s=>s.name===state.venue)?.url}; const link=element('a','Consultar cartelera oficial ↗');safeLink(link,venue.url);empty.append(link); } list.append(empty); }
  let currentDate, grid;
  for (const session of groups) {
    if (session.date !== currentDate) {
      currentDate = session.date;
      const daySection=element('section','','day-group');
      if(state.period!=='today') daySection.append(element('h3',new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(`${session.date}T12:00:00Z`)),'date-heading'));
      grid=element('div','','session-grid');daySection.append(grid);list.append(daySection);
    }
    const card = element('article','','card session');
    const info = element('div','','movie-info'), title = element('h3',session.title);
    info.append(title,element('p',session.venue,'venue-name'));
    const cycleLabel=cycleGroups(session).join(' · ');if(cycleLabel) info.append(element('p',cycleLabel,'cycle-name'));
    const times=element('div','','session-times');times.setAttribute('aria-label',`Horarios de ${session.title}`);
    for(const screening of session.screenings) {
      const link=element('a',screening.time || 'Consultar','session-link');safeLink(link,screening.url);link.removeAttribute('target');
      if(screening.free === true) link.append(element('span','Gratis','language'));
      if(screening.vose) link.append(element('span','VOSE','language'));
      link.setAttribute('aria-label',`Ver sesión de ${screening.title}, ${screening.venue}, ${dateLabel(screening.date)}, ${screening.time || 'consultar hora'}${screening.vose ? ', VOSE' : ''}`);
      times.append(link);
    }
    info.append(times);
    const posterBox=element('div','','poster-box');
const fallback=element('span','Sin imagen','poster-fallback');
fallback.hidden=true;
posterBox.append(fallback);

const image=element('img');
image.width=108;
image.height=162;
image.loading='lazy';
image.decoding='async';

const sources=posterSources(session) || [];

if(!sources.length){
  fallback.hidden=false;
  posterBox.classList.add('no-image');
}else{
  let sourceIndex=0;

  const loadSource=()=>{
    const source=sources[sourceIndex];
    if(!source){
      fallback.hidden=false;
      posterBox.classList.add('no-image');
      return;
    }

    image.alt=`Cartel de ${session.title} · ${source.label || 'Sin imagen'}`;
    image.src=source.url;
  };

  image.onerror=()=>{
    sourceIndex++;
    if(sourceIndex<sources.length){
      loadSource();
    }else{
      image.remove();
      fallback.hidden=false;
      posterBox.classList.add('no-image');
    }
  };

  image.onload=()=>{
    fallback.hidden=true;
    void framePoster(image);
  };

  loadSource();
  posterBox.append(image);
}
    card.append(posterBox,info);grid.append(card);
  }
  const cycles = $('#cycle-filter');
  cycles.replaceChildren(element('option','Todos los ciclos'));
  cycles.firstElementChild.value='';
  for (const cycle of [...new Set(data.sessions.flatMap(cycleGroups).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))) {
    const option=element('option',cycle);option.value=cycle;cycles.append(option);
  }
  cycles.value=state.cycle;
  cycles.classList.toggle('active', Boolean(state.cycle));
  cycles.disabled=cycles.options.length===1;

}
let fetching = false;
async function fetchListings() {
  if(fetching) return; fetching=true;
  $('#refresh').disabled = true; $('#listings').setAttribute('aria-busy','true'); $('#status').textContent = 'Consultando las webs oficiales…';
  try {
    const response = await fetch('/.netlify/functions/listings');
    if(!response.ok) throw new Error('No listings');
    const next = await response.json(); if(!Array.isArray(next.sessions)) throw new Error('Invalid response'); data = next;
    data.today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    data.sessions = data.sessions.filter(s=>s.date>=data.today && isValenciaSession(s));
    const failed = data.sources.filter(s => !s.available).map(s => s.name);
    $('#status').textContent = `Consultado el ${dateLabel(data.today)} a las ${new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}).format(new Date(data.fetchedAt))} (Valencia).${failed.length ? ` Sin datos de: ${failed.join(', ')}.` : ''}`;
    renderVenueOptions();
        render();
  } catch {
    $('#status').textContent = data ? 'No se ha podido actualizar. Se mantiene la última consulta; comprueba las webs oficiales.' : 'No se ha podido cargar la programación. Pulsa «Actualizar cartelera» para reintentar.';
    if(data) render();
    if(!data) { $('#listings').replaceChildren(element('p','Las fuentes no están disponibles en este momento. No se muestran horarios sin verificar.','empty')); }
  } finally { fetching=false; $('#refresh').disabled=false; $('#listings').setAttribute('aria-busy','false'); }
}
$('#search').oninput = e => { state.query=e.target.value; render(); };
document.querySelectorAll('[data-period]').forEach(b => b.onclick = () => {state.period=b.dataset.period;state.day='';render();});
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
  if(button.dataset.filter==='all') Object.assign(state,{vose:false,free:false,rerelease:false});
  else if(button.dataset.filter==='free') state.free=!state.free;
  else if(button.dataset.filter==='vose') state.vose=!state.vose;
  else state.rerelease=!state.rerelease;
  render();
});
$('#cycle-filter').onchange=event=>{
  state.cycle=event.target.value;state.kind='';
  if(state.cycle){state.period='month';state.day='';}
  render();
};
$('#venue-filter').onchange=event=>{state.venue=event.target.value;render();};
$('#reset').onclick=reset; $('#refresh').onclick=fetchListings;
fetchListings();

setInterval(()=>{if(!document.hidden) void fetchListings();},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) void fetchListings();});
window.addEventListener('online',()=>void fetchListings());
