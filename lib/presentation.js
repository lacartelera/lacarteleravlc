import { cycleGroups } from './cycles.js';
export { cycleGroups } from './cycles.js';
export { displayName } from './names.js';
export function cycleGroup(session) { return cycleGroups(session)[0] || ''; }

export function groupScreenings(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const key = JSON.stringify([session.title, session.venue, session.date]);
    if (!groups.has(key)) groups.set(key, { ...session, screenings: [] });
    groups.get(key).screenings.push(session);
  }
  return [...groups.values()].map(group => ({ ...group, cycles:[...new Set(group.screenings.flatMap(cycleGroups))], screenings:group.screenings.sort((a,b)=>a.time.localeCompare(b.time)) }));
}
