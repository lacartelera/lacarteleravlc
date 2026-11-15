import { displayName } from './names.js';
const canonical = [
  [/mostra/i,'Mostra de València'],
  [/seminci/i,'Seminci: Memoria y Utopía'],
  [/xvii\s+cortos\s+por\s+la\s+igualdad/i,'XVII Cortos por la Igualdad'],
  [/aula de cinema/i,'Aula de Cinema'],
  [/billy wilder/i,'Billy Wilder'],
  [/pere portabella/i,'Pere Portabella'],
  [/centenario rafael azcona/i,'Centenario Rafael Azcona'],
  [/terror[ií]ficamente lys/i,'Terroríficamente Lys'],
  [/^[oó]pera$|^ballet$|[oó]pera\s*(?:&|y|\/)\s*ballet/i,'Ópera & Ballet'],
  [/proyecto viridiana/i,'Proyecto Viridiana'],
  [/dijous de (?:pel[·.]?l[ií]cula|cine)/i,'Dijous de Pel·lícula'],
];
export function cycleGroups(session) {
  const labels=[...(session.cycles || []),...(session.cycle || '').split(/\s+·\s+/)];
  // A named programme can be published under a generic calendar category.
  const title=session.title || '';
  for(const [pattern,label] of canonical) if(pattern.test(title))labels.push(label);
  const result=[];
  for(const raw of labels){
    const label=raw.trim();
    if(!label || /^(?:eventos?(?: especiales)?|events?(?: special)?|reestrenos?|estrenos|infantil|cine|cinema|movie)$/i.test(label))continue;
    if((/Cines Lys/i.test(session.venue) && /cine\s*club/i.test(label)) || /cine\s*club\s+lys/i.test(label))continue;
    const name=canonical.find(([pattern])=>pattern.test(label))?.[1] || displayName(label);
    if(!result.includes(name))result.push(name);
  }
  return result;
}
