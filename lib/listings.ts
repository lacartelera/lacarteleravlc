import { load } from 'cheerio';
import { displayName } from './presentation.js';

export type Session = { id: string; title: string; venue: string; date: string; time: string; vose: boolean; cycle: string; festival: boolean; details: string; url: string; poster?: string; posters?: string[]; posterPage?: string; rerelease?: boolean; free?: boolean; city?: string; director?: string; year?: number; cycles?: string[] };
export function madridDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function calendarDate(day: number, month: number, today: string) {
  const year = Number(today.slice(0,4)) + (Number(today.slice(5,7)) >= 11 && month <= 2 ? 1 : 0);
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function isRerelease(text: string, year?: number, today = madridDate()) {
  return /\breestreno|cl[áa]sico|restaurad|retrospectiva|wilder|\b(?:[2-9]\d|1\d{2})[.º°\s]*(?:aniversario|años)/i.test(text)
    || Boolean(year && year <= Number(today.slice(0,4)) - 10);
}
export function parseBabel(html: string, today: string): Session[] {
  const $ = load(html), sessions: Session[] = [];
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  $('.pelicula-post').each((index, el) => {
    const node = $(el), title = displayName(node.find('h2').first().text());
    const details = node.find('.pelicula-title').text().replace(/\s+/g,' ').trim();
    const poster = node.find('.caratula img').first().attr('src') || '';
    const vose = /Subtítulos:\s*Español/i.test(details) && !/Idioma:\s*(?:Español|Castellano)/i.test(details);
    node.find('.tabla-sesiones tr').each((_, tr) => {
      const dateParts = $(tr).find('td').first().text().match(/(\d{1,2})\s+(\p{L}+)/u);
      if (!dateParts) return;
      const month = months.indexOf(dateParts[2].slice(0,3).toLowerCase()) + 1;
      if (!month) return;
      const date = calendarDate(Number(dateParts[1]), month, today);
      $(tr).find('a').each((_, a) => {
        const time = $(a).text().trim();
        if (title && /^\d{2}:\d{2}$/.test(time)) sessions.push({id:`babel-${index}-${date}-${time}`,title,venue:'Cines Babel',date,time,vose,cycle:'',festival:false,details,url:$(a).attr('href') || '',poster,rerelease:isRerelease(title)});
      });
    });
  });
  // Support the home-page format if a publisher redirects the cartelera route.
  if (!sessions.length) $('.films-titles li[data-film]').each((_, el) => {
    const title = displayName($(el).find('h2').text());
    $(el).find('.sessions a').each((_, a) => {
      const time = $(a).text().trim();
      if (title && /^\d{2}:\d{2}$/.test(time)) sessions.push({ id: `babel-${$(el).attr('data-film')}-${time}`, title, venue: 'Cines Babel', date: today, time, vose: /\bVOSE\b/i.test($(el).text()), cycle: '', festival: false, details: 'Consulta el idioma en la web de la sala', url: $(a).attr('href') || 'https://cinesbabel.com/', rerelease:isRerelease(title) });
    });
  });
  return sessions;
}
export function parseFilmoteca(html: string, today: string): Session[] {
  const $ = load(html), sessions: Session[] = [], months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  $('.actividad').each((i, el) => {
    const node = $(el);
    const location=node.find('.lugar').text();
    if (!/val[eè]ncia/i.test(location) || /alicante|alacant|arniches|castell[oó]/i.test(location)) return;
    const month = months.indexOf(node.find('.mes').text().trim().toLowerCase());
    const day = node.find('.dia').text().trim().padStart(2, '0');
    const url = node.find('.btn-venta-entradas').attr('href') || node.find('h2 a').attr('href') || '';
    const explicit = url.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const year = Number(today.slice(0,4)) + (Number(today.slice(5,7)) >= 11 && month <= 1 ? 1 : 0);
    const date = explicit?.[1] || `${year}-${String(month + 1).padStart(2,'0')}-${day}`;
    const title = displayName(node.find('h2').text()), time = node.find('.hora').text().match(/\d{1,2}:\d{2}/)?.[0]?.padStart(5,'0');
    const cycle = displayName(node.find('.extra-ciclo').text()), details = node.find('.textos-peli p').text().trim();
    if (title && time && month >= 0) sessions.push({ id: `filmoteca-${i}`, title, venue: 'Filmoteca de València (Rialto)', date, time, vose: /VOS(?:E|\s+CASTELLANO)/i.test(details), cycle, festival: /mostra|festival/i.test(cycle), details, url, poster: node.find('.foto-peli img').attr('src') || '', rerelease: isRerelease(`${title} ${cycle}`, Number(details.match(/·\s*((?:18|19|20)\d{2})\s*·/)?.[1]), today) });
  });
  return sessions;
}
export function parseLys(data: any): Session[] {
  if (!Array.isArray(data.events)) throw new Error('Invalid events');
  return data.events.flatMap((e: any) => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(e.start_date)) return [];
    const $ = load(e.description || '');
    const details = $.text().replace(/\s+/g,' ').trim();
    const cycle = displayName((e.categories || []).map((c: any) => load(c.name).text()).join(' · '));
    const title = displayName(load(e.title).text()), date = e.start_date.slice(0,10);
    const common = { free: e.is_free === true || /entrada (?:libre|gratuita)|acceso gratuito/i.test(details) || (e.cost !== '' && e.cost != null && Number(e.cost) === 0), title, venue:'Cines Lys', cycle, festival:/festival|mostra/i.test(cycle), details:details.slice(0,1500), url:e.url, posterPage:$('a[href*="reservaentradas.com/"]').first().attr('href'), poster:e.image?.sizes?.large?.url || e.image?.url || '', posters:[e.image?.sizes?.large?.url,e.image?.url,e.image?.sizes?.medium?.url].filter(Boolean), rerelease:isRerelease(`${title} ${cycle}`) };
    if (!e.all_day) return [{ ...common, id:`lys-${e.id}`, date, time:e.start_date.slice(11,16), vose:/\bVOSE\b|VOS CASTELLANO/i.test(details) }];
    const sessions: Session[] = [];
    // All-day calendar entries often publish their actual times in the headings.
    $('h2,h3,h4').each((_, heading) => {
      const text = $(heading).text().replace(/\s+/g,' ');
      const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const dateMatch = text.match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
      const publishedDate = dateMatch ? calendarDate(Number(dateMatch[1]),monthNames.indexOf(dateMatch[2].toLowerCase())+1,date) : date;
      const times = [...text.matchAll(/\b([0-2]?\d)[:.]([0-5]\d)\s*h?\b/g)];
      times.forEach((match, index) => {
        const time = `${match[1].padStart(2,'0')}:${match[2]}`;
        const segment = text.slice(match.index! + match[0].length, times[index+1]?.index);
        if (!sessions.some(s => s.date===publishedDate && s.time===time)) sessions.push({...common,id:`lys-${e.id}-${publishedDate}-${time}`,date:publishedDate,time,vose:/\bVOSE\b|VOS CASTELLANO/i.test(segment)});
      });
    });
    return sessions.length ? sessions : [{...common,id:`lys-${e.id}`,date,time:'',vose:/\bVOSE\b/i.test(details)}];
  });
}
export function parseLysCartelera(html: string, today: string): Session[] {
  const $ = load(html), sessions: Session[] = [];
  const json = $('script').map((_,el) => $(el).text()).get().join('\n').match(/window\.reAnalyticsSesiones\s*=\s*(\{[^;]+\});/);
  const metadata = json ? JSON.parse(json[1]) : {};
  $('.movie').each((_,el) => {
    const node=$(el), title=displayName(node.find('.title-movie-list a').first().text());
    const poster=node.find('.caratula-cine img').first().attr('data-original') || '';
    node.find('a.sesion').each((_,a)=>{
      const time=$(a).text().trim(), url=$(a).attr('href') || '';
      if (!/^\d{2}:\d{2}$/.test(time)) return;
      const id=url.match(/\/(\d+)\//g)?.at(-1)?.replaceAll('/','');
      const entry=metadata[id || ''];
      if (!entry?.session_datetime) return; // Never assign an undated session to today.
      sessions.push({id:`lys-regular-${id}`,title,venue:'Cines Lys',date:entry.session_datetime.slice(0,10),time,vose:/VOSE/i.test(entry.item_category4 || ''),cycle:'',festival:false,details:'Cartelera publicada por Cines Lys',url,poster,rerelease:isRerelease(title,undefined,today)});
    });
  });
  return sessions;
}

export function mergeSessions(sessions: Session[]): Session[] {
  const unique = new Map<string, Session>();
  for (const session of sessions) {
    const canonicalTitle = session.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/^reestreno\s*[:–-]?\s*/,'').replace(/\(\d{4}\)/g,'').replace(/[^\p{L}\p{N}]/gu,'');
    const key = `${session.venue}|${session.date}|${session.time}|${session.vose}|${canonicalTitle}`;
    const previous = unique.get(key);
    unique.set(key, previous ? { ...previous, cycles:[...new Set([...(previous.cycles || []),...(session.cycles || []),previous.cycle,session.cycle].filter(Boolean))], free:previous.free || session.free, cycle:previous.cycle || session.cycle, rerelease:previous.rerelease || session.rerelease, poster:session.poster || previous.poster, posters:[...new Set([session.poster,...(session.posters || []),previous.poster,...(previous.posters || [])].filter(Boolean))] as string[], url:session.url || previous.url } : session);
  }
  return [...unique.values()];
}
