import { openDB, type DBSchema } from 'idb';
import * as exifr from 'exifr';
import type { ImportOptions, LocalOperation, Memory, Photo, Subject } from './types';
import { localISO } from './dates';

interface Asset { key: string; blob: Blob }
interface AmorchiSchema extends DBSchema {
  photos: { key: string; value: Photo };
  memories: { key: string; value: Memory };
  subjects: { key: string; value: Subject };
  assets: { key: string; value: Asset };
  operations: { key: string; value: LocalOperation };
}
const database = openDB<AmorchiSchema>('amorchi-local-v1', 1, {
  upgrade(db) {
    db.createObjectStore('photos', { keyPath: 'id' });
    db.createObjectStore('memories', { keyPath: 'id' });
    db.createObjectStore('subjects', { keyPath: 'id' });
    db.createObjectStore('assets', { keyPath: 'key' });
    db.createObjectStore('operations', { keyPath: 'id' });
  }
});

const op = (entity: LocalOperation['entity'],entityId:string):LocalOperation=>({
  id:crypto.randomUUID(), type:'upsert', entity, entityId, createdAt:new Date().toISOString()
});

export async function loadLibrary() {
  const db=await database;
  const [photos,memories,subjects,operations]=await Promise.all([
    db.getAll('photos'),db.getAll('memories'),db.getAll('subjects'),db.getAll('operations')
  ]);
  return {photos,memories,subjects,operations};
}

export async function saveMemory(memory:Memory){
  const db=await database;
  const tx=db.transaction(['memories','operations'],'readwrite');
  await tx.objectStore('memories').put(memory);
  await tx.objectStore('operations').put(op('memory',memory.id));
  await tx.done;
}

export async function saveSubject(subject:Subject){
  const db=await database;
  const tx=db.transaction(['subjects','operations'],'readwrite');
  await tx.objectStore('subjects').put(subject);
  await tx.objectStore('operations').put(op('subject',subject.id));
  await tx.done;
}

export async function savePhoto(photo:Photo){
  const db=await database;
  const tx=db.transaction(['photos','operations'],'readwrite');
  await tx.objectStore('photos').put(photo);
  await tx.objectStore('operations').put(op('photo',photo.id));
  await tx.done;
}

async function webpVariant(file:File,max:number,quality:number):Promise<Blob|undefined>{
  let bitmap:ImageBitmap|undefined;
  try {
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    if(!context) return;
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|undefined>(resolve=>canvas.toBlob(b=>resolve(b||undefined),'image/webp',quality));
    return blob?.type==='image/webp'?blob:undefined;
  } catch { return undefined; }
  finally { bitmap?.close(); }
}

export async function importPhoto(file:File,opts:ImportOptions):Promise<Photo> {
  if(file.size>60*1024*1024) throw new Error('Archivo de más de 60 MB: requiere importación desde el servidor.');
  if(!file.type.startsWith('image/') && !/\.(heic|heif|jpg|jpeg|png|webp|avif)$/i.test(file.name)){
    throw new Error('Solo se admiten imágenes en esta primera versión.');
  }
  const db=await database;
  // Deduplicación exacta; no modifica el archivo original.
  const bytes=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const existing=(await db.getAll('photos')).find(p=>p.hash===hash);
  if(existing) throw new Error('Esta fotografía ya está importada (archivo idéntico).');

  let exif:Record<string,unknown>|undefined;
  try { exif=(await exifr.parse(file)) as Record<string,unknown>|undefined; } catch { /* Sin EXIF válido */ }
  const captured=exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal :
                 exif?.CreateDate instanceof Date ? exif.CreateDate : undefined;
  const fileDate=new Date(file.lastModified);
  const date=captured || (Number.isFinite(fileDate.getTime())?fileDate:new Date());
  const takenOn=opts.overrideDate || localISO(date);
  const takenTime=String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
  const latitude=typeof exif?.latitude==='number'?exif.latitude:undefined;
  const longitude=typeof exif?.longitude==='number'?exif.longitude:undefined;
  const photo:Photo={
    id:crypto.randomUUID(), filename:file.name,mimeType:file.type||'application/octet-stream',
    size:file.size, hash, takenOn, takenTime,
    dateSource:opts.overrideDate?'manual':captured?'exif':'file',
    place:opts.place, latitude,longitude,
    memoryIds:opts.memoryId?[opts.memoryId]:[],
    subjectIds:opts.subjectIds, description:'',favorite:false,createdAt:new Date().toISOString()
  };
  const [preview,thumbnail]=await Promise.all([
    webpVariant(file,2560,0.82),webpVariant(file,360,0.72)
  ]);
  // Transacción única: nunca debe quedar una ficha sin su archivo original.
  const tx=db.transaction(['photos','assets','operations'],'readwrite');
  await tx.objectStore('assets').put({key:photo.id+':original',blob:file});
  if(preview)await tx.objectStore('assets').put({key:photo.id+':preview',blob:preview});
  if(thumbnail)await tx.objectStore('assets').put({key:photo.id+':thumb',blob:thumbnail});
  await tx.objectStore('photos').put(photo);
  await tx.objectStore('operations').put(op('photo',photo.id));
  await tx.done;
  return photo;
}

export async function getPhotoAsset(id:string,quality:'thumb'|'preview'|'original'='thumb'):Promise<Blob|undefined>{
  const db=await database;
  const result=await db.get('assets',id+':'+quality);
  if(result)return result.blob;
  return (await db.get('assets',id+':original'))?.blob;
}

export async function getLocalUsage():Promise<{bytes:number;quota?:number;usage?:number}>{
  const db=await database;
  const assets=await db.getAll('assets');
  const bytes=assets.reduce((sum,a)=>sum+a.blob.size,0);
  const estimate=await navigator.storage?.estimate?.().catch(()=>undefined);
  return {bytes,quota:estimate?.quota,usage:estimate?.usage};
}

export async function requestPersistence():Promise<boolean>{
  return Boolean(await navigator.storage?.persist?.().catch(()=>false));
}
