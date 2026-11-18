import { load } from 'cheerio';
import type { Session } from './listings.ts';

export const culturalSources = [
  { name:'Universitat de València · La Nau', url:'https://www.uv.es/uvweb/cultura/ca/activitats-convocatories/arees-programacio/cinema/programacio/actuals-1285866179260.html', kind:'uv', coverage:'Aula de Cinema y ciclos universitarios; solo sesiones con fecha publicada.' },
  { name:'Universitat Politècnica de València', url:'https://www.upv.es/entidades/acu/carpeta/cine-es-es/', kind:'upv', coverage:'Programación cinematográfica universitaria; requiere fechas de proyección verificables.' },
  { name:'Col·legi Major Rector Peset', url:'https://www.uv.es/uvweb/colegi-major-rector-peset/ca/col-legi-major-rector-peset-1285910232936.html',kind:'uv',coverage:'Proyecciones y ciclos publicados por el colegio mayor.' },
  { name:'MuVIM · ciclos de cine', url:'http://www.muvim.es/es/cartelera', kind:'structured', coverage:'Ciclos culturales con fechas de proyección publicadas.' },
  { name:'Centre del Carme', url:'https://www.consorcimuseus.gva.es/centro-del-carmen/', kind:'structured', coverage:'Cine en el centro cultural y programación de verano publicada.' },
  { name:'Cine d’Estiu · Plaza de Toros',url:'https://plazadevalencia.es/',kind:'structured',coverage:'Programación publicada por el recinto; solo se incorporan proyecciones de cine con fecha confirmada.' },
  { name:'Cines de verano municipales', url:'https://www.valencia.es/cas/cultura/agenda',kind:'structured',coverage:'Agenda municipal: proyecciones y cine al aire libre con fechas publicadas.' },
  { name:'Nits de Cinema · La Nau', url:'https://www.uv.es/uvweb/cultura/ca/activitats-convocatories/arees-programacio/cinema/nits-cinema-claustre-1285887666902.html', kind:'uv', coverage:'Cine de verano; solo proyecciones vigentes con fecha confirmada.' },
  { name:'Filmoteca d’Estiu', url:'https://ivc.gva.es/es/audiovisuales/la-filmoteca-es/la-filmoteca-destiu', kind:'filmoteca', coverage:'Programación oficial de verano en València, cuando se publica.' },
];
export async function readPage(url: string) {
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'LaCarteleraValencia/1.0 (agenda cultural)'}});
  if(!response.ok) throw new Error('Source unavailable');
  return response.text();
}
export function isFree(text: string) {
  return /entrada\s+(?:libre|gratuita|lliure|gratuïta)|acc[eé]s\s+gratu[iï]t|acceso\s+gratuito/i.test(text);
}
export function parseUVDetail(html: string, url: string): Session[] {
  const $=load(html);$('script,style,nav,footer').remove();
  const text=$('body').text().replace(/\s+/g,' ');
  const content=($('#content').text()+' '+$('#sidebar').text()).trim() || text;
  if(!/cinema|pel.l[ií]cula|projecci[oó]|proyecci[oó]|aula de cine/i.test(content))return [];
  const months=['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
  const date=text.match(/(?:Data|Fecha)\s*:\s*(\d{1,2})\s+d[e’']?\s*(\p{L}+)\s+d[e’']?\s*(\d{4})\s+(?:de|a les)\s+(\d{1,2}):(\d{2})/u);
  if(!date) return [];
  const month=months.indexOf(date[2].toLowerCase())+1;
  if(!month) return [];
  let centre=text.match(/(?:Centre|Centro)\s*:\s*(.+?)(?:Sales|Salas|Organitza|Organiza|Comparteix)\s*:/)?.[1]?.trim();
  // Only venues in València city: exclude other UV campuses and Gandia.
  if(!centre || !/La Nau|Rector Peset|Botànic|Cerveró|Blasco Ib|Tarongers/i.test(centre)) return [];
  centre=/La Nau/i.test(centre)?'Centre Cultural La Nau':/Rector Peset/i.test(centre)?'Col·legi Major Rector Peset':centre;
  const title=($('.titol-seccio').first().text() || $('h1').last().text() || $('title').text()).trim();
  if(!title) return [];
  const cycle=text.match(/Cicl[eo]\s+(.+?)(?:\. Centre|\s+Cicl[eo]|\s+\bEntrada\b)/)?.[1]?.split(title)[0]?.trim() || 'Aula de Cinema';
  const poster=$('meta[property="og:image"]').attr('content') || $('.imagenNoticia').first().attr('src');
  return [{id:url,title,venue:centre,date:`${date[3]}-${String(month).padStart(2,'0')}-${date[1].padStart(2,'0')}`,time:`${date[4].padStart(2,'0')}:${date[5]}`,url,cycle,details:text.slice(text.indexOf(title),text.indexOf('Comparteix:')).slice(0,1800),vose:/VOSE|VOS CASTELLANO/i.test(text),festival:false,cycles:['Aula de Cinema',cycle],free:isFree(text),poster:poster?new URL(poster,url).href:undefined}];
}
export function parseStructured(html: string, base: string, venue: string): Session[] {
  const $=load(html), sessions:Session[]=[];
  function visit(value:any){
    if(!value || typeof value!=='object') return;
    if(Array.isArray(value)){value.forEach(visit);return;}
    const types=[value['@type']].flat();
    if(types.some(t=>['ScreeningEvent','MovieTheaterEvent','Event'].includes(t)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value.startDate || '')){
      const description=load(value.description || '').text(), title=String(value.name || '');
      const location=value.location;
      const city=location?.address?.addressLocality || '';
      if(city && !/^val[eè]ncia$/i.test(city)) return;
      if(!/cin[eé]|cinema|pel[ií]cula|proyecci[oó]n|projecci[oó]|film/i.test(title+' '+description) && !types.includes('ScreeningEvent')) return;
      if(value.eventStatus && !String(value.eventStatus).endsWith('EventScheduled')) return;
      let url;try{url=new URL(value.url || base,base);if(url.protocol!=='https:')return;}catch{return;}
      const offers=[value.offers].flat().filter(Boolean);
      const free=value.isAccessibleForFree===true || (offers.length>0 && offers.every((o:any)=>o.price!==undefined && o.price!==null && o.price!=='' && Number(o.price)===0)) || isFree(description);
      const image=[value.image].flat()[0];
      sessions.push({id:url.href+value.startDate,title,city,venue:location?.name || venue,date:value.startDate.slice(0,10),time:value.startDate.slice(11,16),url:url.href,cycle:value.superEvent?.name || '',details:description.slice(0,1800),vose:/VOSE/i.test(description),festival:/festival/i.test(description),free,poster:typeof image==='string'?image:image?.url});
    }
    for(const child of Object.values(value))if(child && typeof child==='object')visit(child);
  }
  $('script[type="application/ld+json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()));}catch{}});
  return sessions;
}
export async function collectCultural(source:typeof culturalSources[number], html:string) {
  const $=load(html), urls=new Set<string>();
  if(source.kind==='uv'){
    $('a[href*="Activitat.html"],a[href*="Esdeveniment.html"]').each((_,el)=>{const href=$(el).attr('href');if(href)urls.add(new URL(href,source.url).href);});
  }else{
    $('main a[href],article a[href],.view-content a[href]').each((_,el)=>{
      const href=$(el).attr('href');if(!href)return;
      const url=new URL(href,source.url);
      if(url.origin===new URL(source.url).origin && /cine|cinema|terrorismo|proyecci|film|dijous|pel.l[ií]cula/i.test(url.pathname+' '+$(el).text()))urls.add(url.href);
    });
  }
  const sessions=source.kind==='upv'?parseUPV(html,source.url):parseStructured(html,source.url,source.name);
  const results=await Promise.all([...urls].slice(0,12).map(async url=>{
    try{const body=await readPage(url);return source.kind==='uv'?parseUVDetail(body,url):source.kind==='upv'?parseUPV(body,url):parseStructured(body,url,source.name);}catch{return [];}
  }));
  return sessions.concat(results.flat());
}

export function parseUPV(html:string,url:string):Session[]{
  const $=load(html), sessions:Session[]=[];
  const body=$('body').text().replace(/\s+/g,' ');
  if(!/Dijous|pel·lícula|pelicula|cine/i.test(body))return sessions;
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  let year='';
  $('h2,div').each((_,el)=>{
    const node=$(el);
    if(el.tagName==='h2'){
      const match=node.text().trim().match(/^\|?\s*(20\d{2})$/);if(match)year=match[1];
      return;
    }
    const dateText=node.children('span').first().text().trim();
    const match=dateText.match(/^(\d{1,2})\s+(\p{L}+)$/u), title=node.find('em').first().text().trim();
    const month=match?months.indexOf(match[2].toLowerCase())+1:0;
    if(!match || !month || !year || !title)return;
    const date=`${year}-${String(month).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    const hour=body.match(/(\d{1,2})\s*h,?\s*Sal[oó]n de Actos/);
    if(!hour)return;
    const credit=node.children('span').last().text().replace(title,'').trim();
    const movie=credit.match(/^(.+?),\s*((?:18|19|20)\d{2})$/);
    sessions.push({director:movie?.[1],year:movie?Number(movie[2]):undefined,id:`upv-${date}-${title}`,title,venue:'Universitat Politècnica de València',date,time:hour[1].padStart(2,'0')+':00',url,cycle:'Dijous de Pel·lícula',details:'Salón de Actos de Rectorado · Edificio 3A · '+credit,vose:/V\.O\. con subt[ií]tulos en castellano/i.test(body),festival:false,free:isFree(body)});
  });
  return sessions;
}
