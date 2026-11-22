import type {Memory,Photo} from './types.ts';

/** Fotos del mismo día o de cualquier viaje/recuerdo que comparta la foto actual.
 * Se incluyen las coincidencias una sola vez y se mantienen en orden cronológico. */
export function relatedPhotos(photo:Photo,photos:Photo[]):Photo[]{
  const memoryIds=new Set(photo.memoryIds);
  const included=photos.filter(p=>p.id===photo.id||p.takenOn===photo.takenOn||p.memoryIds.some(id=>memoryIds.has(id)));
  return included.sort((a,b)=>a.takenOn.localeCompare(b.takenOn)||
    (a.takenTime||'').localeCompare(b.takenTime||'')||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}

/** Una asociación directa se muestra antes que los viajes que coinciden por fecha. */
export function relatedMemories(photo:Photo,memories:Memory[]):Memory[]{
  const direct=new Set(photo.memoryIds);
  return memories.filter(m=>direct.has(m.id)||(m.startDate<=photo.takenOn&&m.endDate>=photo.takenOn))
    .sort((a,b)=>Number(direct.has(b.id))-Number(direct.has(a.id))||a.title.localeCompare(b.title,'es'));
}
