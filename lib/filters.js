import { cycleGroups } from './presentation.js';
export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0,10);
}
export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matches(session, state, today) {
  const end = state.period === 'today' ? today : state.period === 'week' ? addDays(today, 6) : `${today.slice(0,7)}-31`;
  if (session.date < today || session.date > end || (state.day && session.date !== state.day)) return false;
  if (state.venue && session.venue !== state.venue) return false;
  if (state.free && session.free !== true) return false;
  if (state.rerelease && !session.rerelease) return false;
  if (state.vose && !session.vose) return false;
  if (state.kind === 'cycles' && !session.cycle) return false;
  if (state.kind === 'festivals' && !session.festival) return false;
  if (state.cycle && !cycleGroups(session).includes(state.cycle)) return false;
  return normalize([session.title, session.venue, session.cycle, ...(session.cycles || []), session.details].join(' ')).includes(normalize(state.query.trim()));
}
