import type { Photo } from './types';

/** Desvincula únicamente el recuerdo eliminado; el archivo y demás recuerdos permanecen. */
export function unlinkMemory(photo:Photo, memoryId:string):Photo {
  return photo.memoryIds.includes(memoryId)
    ? {...photo,memoryIds:photo.memoryIds.filter(id=>id!==memoryId)}
    : photo;
}
