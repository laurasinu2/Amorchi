import { openDB, type DBSchema } from 'idb';
import * as exifr from 'exifr';
import { sha256 } from 'js-sha256';
import { createId } from './id';
import { defaultSettings, type ImportOptions, type LocalOperation, type Memory, type Photo, type Subject, type AppSettings, type PhotoCollection } from './types';
import { localISO } from './dates';
import { unlinkMemory } from './memoryLinks';

interface Asset { key: string; blob: Blob }
interface AssetSize { key: string; bytes: number }
interface AmorchiSchema extends DBSchema {
  photos: { key: string; value: Photo };
  memories: { key: string; value: Memory };
  subjects: { key: string; value: Subject };
  assets: { key: string; value: Asset };
  asset_sizes: { key: string; value: AssetSize };
  operations: { key: string; value: LocalOperation };
  settings: { key: string; value: AppSettings };
  map_assets: { key: string; value: Asset };
  collections: { key: string; value: PhotoCollection };
}
const database = openDB<AmorchiSchema>('amorchi-local-v1', 5, {
  upgrade(db) {
    if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('memories')) db.createObjectStore('memories', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'key' });
    if(!db.objectStoreNames.contains('operations')) db.createObjectStore('operations', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('asset_sizes')) db.createObjectStore('asset_sizes', { keyPath: 'key' });
    if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('map_assets')) db.createObjectStore('map_assets', { keyPath: 'key' });
    if(!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
  }
});

const op = (entity: LocalOperation['entity'],entityId:string):LocalOperation=>({
  id:createId(), type:'upsert', entity, entityId, createdAt:new Date().toISOString()
});

export async function loadLibrary() {
  const db=await database;
  const [photos,memories,subjects,operations,settings,collections]=await Promise.all([
    db.getAll('photos'),db.getAll('memories'),db.getAll('subjects'),db.getAll('operations'),db.get('settings','main'),db.getAll('collections')
  ]);
  return {photos,memories,subjects,operations,settings:settings||defaultSettings,collections};
}

export async function saveCollection(collection:PhotoCollection):Promise<void>{
  const db=await database;
  const tx=db.transaction(['collections','operations'],'readwrite');
  await tx.objectStore('collections').put(collection);
  await tx.objectStore('operations').put(op('collection',collection.id));
  await tx.done;
}

export async function saveSettings(settings:AppSettings){
  const db=await database;
  const tx=db.transaction(['settings','operations'],'readwrite');
  await tx.objectStore('settings').put(settings);
  await tx.objectStore('operations').put(op('settings','main'));
  await tx.done;
}


/**
 * Elimina un viaje, evento o momento localmente, pero NO sus fotografías.
 * Fotos vinculadas a otros recuerdos conservan esas asociaciones.
 * Todo sucede en una sola transacción, incluyendo la cola de borrados.
 */
export async function deleteMemory(memoryId:string):Promise<void>{
  const db=await database;
  const tx=db.transaction(['memories','photos','operations'],'readwrite');
  try{
    const memoryStore=tx.objectStore('memories');
    const photoStore=tx.objectStore('photos');
    const operationStore=tx.objectStore('operations');
    const memory=await memoryStore.get(memoryId);
    if(!memory)throw new Error('El recuerdo ya no existe.');

    const affectedPhotos=new Set<string>();
    const allPhotos=await photoStore.getAll();
    for(const photo of allPhotos){
      if(!photo.memoryIds.includes(memoryId))continue;
      await photoStore.put(unlinkMemory(photo,memoryId));
      affectedPhotos.add(photo.id);
    }

    // Evita que operaciones locales anteriores recreen enlaces o el recuerdo borrado.
    for(const pending of await operationStore.getAll()){
      if((pending.entity==='memory'&&pending.entityId===memoryId)
        ||(pending.entity==='photo'&&affectedPhotos.has(pending.entityId)&&pending.type==='upsert')){
        await operationStore.delete(pending.id);
      }
    }
    for(const photoId of affectedPhotos){
      await operationStore.put(op('photo',photoId));
    }
    await memoryStore.delete(memoryId);
    await operationStore.put({...op('memory',memoryId),type:'delete'});
    await tx.done;
  }catch(err){
    if(tx.db.name){try{tx.abort();}catch{/* Tx cerrada o ya abortada */}}
    throw err;
  }
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


/**
 * Elimina permanentemente la foto y TODAS sus variantes locales en una única
 * transacción. Conserva el tombstone en la cola para que el futuro servidor
 * aplique el borrado remoto. No eliminar las operaciones "delete" de la cola.
 */
export async function deletePhoto(photoId:string):Promise<void>{
  const db=await database;
  const tx=db.transaction(['photos','assets','asset_sizes','operations','memories','settings','collections','subjects'],'readwrite');
  const photoStore=tx.objectStore('photos');
  const memoryStore=tx.objectStore('memories');
  const settingsStore=tx.objectStore('settings');
  const operations=tx.objectStore('operations');
  const photo=await photoStore.get(photoId);
  if(!photo){
    tx.abort();
    throw new Error('La fotografía ya no existe.');
  }
  // Limpiar referencias de portada en toda la biblioteca, no solo el recuerdo activo.
  const memories=await memoryStore.getAll();
  for(const m of memories){
    if(m.coverPhotoId===photoId){
      await memoryStore.put({...m,coverPhotoId:undefined,coverPosition:undefined});
      await operations.put(op('memory',m.id));
    }
  }
  // Las fichas de personas y mascotas conservan sus datos si se borra su avatar.
  for(const subject of await tx.objectStore('subjects').getAll()){
    if(subject.avatarPhotoId===photoId){
      await tx.objectStore('subjects').put({...subject,avatarPhotoId:undefined});
      await operations.put(op('subject',subject.id));
    }
  }
  // La colección conserva su ficha; únicamente se elimina la foto borrada.
  for(const collection of await tx.objectStore('collections').getAll()){
    if(collection.photoIds.includes(photoId)){
      await tx.objectStore('collections').put({...collection,photoIds:collection.photoIds.filter(id=>id!==photoId)});
      await operations.put(op('collection',collection.id));
    }
  }
  const settings=await settingsStore.get('main');
  if(settings){
    const yearCovers=Object.fromEntries(Object.entries(settings.yearCoverPhotoIds||{}).filter(([,id])=>id!==photoId));
    if(settings.homeCoverPhotoId===photoId||settings.profilePhotoId===photoId||Object.keys(yearCovers).length!==Object.keys(settings.yearCoverPhotoIds||{}).length){
      const yearPositions={...(settings.yearCoverPositions||{})};
      for(const key of Object.keys(settings.yearCoverPhotoIds||{})){
        if(settings.yearCoverPhotoIds?.[key]===photoId)delete yearPositions[key];
      }
      await settingsStore.put({...settings,yearCoverPhotoIds:yearCovers,yearCoverPositions:yearPositions,
        homeCoverPhotoId:settings.homeCoverPhotoId===photoId?undefined:settings.homeCoverPhotoId,
        homeCoverPosition:settings.homeCoverPhotoId===photoId?undefined:settings.homeCoverPosition,
        profilePhotoId:settings.profilePhotoId===photoId?undefined:settings.profilePhotoId});
      await operations.put(op('settings','main'));
    }
  }
  for(const variant of ['original','preview','thumb']){
    await tx.objectStore('assets').delete(photoId+':'+variant);
    await tx.objectStore('asset_sizes').delete(photoId+':'+variant);
  }
  await photoStore.delete(photoId);
  const existing=await operations.getAll();
  for(const prior of existing){
    if(prior.entity==='photo'&&prior.entityId===photoId&&prior.type==='upsert')
      await operations.delete(prior.id);
  }
  await operations.put({...op('photo',photoId),type:'delete'});
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

export interface PhotoInspection {
  takenOn:string;
  takenTime:string;
  dateSource:'exif'|'file';
  latitude?:number;
  longitude?:number;
}

// Cache por referencia a File durante la importación. No sube datos a ningún servidor.
const inspectionCache=new WeakMap<File,Promise<PhotoInspection>>();

function readExifDate(value:unknown):Date|undefined{
  if(value instanceof Date) return Number.isFinite(value.getTime())?value:undefined;
  if(typeof value==='string'){
    const match=/^(\\d{4})[:/-](\\d{2})[:/-](\\d{2})[ T](\\d{2}):(\\d{2})(?::(\\d{2}))?/.exec(value);
    if(match){
      const [,y,m,d,h,min,s]=match;
      const date=new Date(Number(y),Number(m)-1,Number(d),Number(h),Number(min),Number(s||0));
      return Number.isFinite(date.getTime())?date:undefined;
    }
    const parsed=new Date(value);
    return Number.isFinite(parsed.getTime())?parsed:undefined;
  }
  return undefined;
}

export async function inspectPhoto(file:File):Promise<PhotoInspection>{
  const cached=inspectionCache.get(file);
  if(cached)return cached;
  const inspection=(async()=>{
    const [exif,gps]=await Promise.all([
      exifr.parse(file).catch(()=>undefined) as Promise<Record<string,unknown>|undefined>,
      exifr.gps(file).catch(()=>undefined)
    ]);
    const captured=readExifDate(exif?.DateTimeOriginal)
      ||readExifDate(exif?.CreateDate)
      ||readExifDate(exif?.DateTimeDigitized)
      ||readExifDate(exif?.DateTime)
      ||readExifDate(exif?.ModifyDate);
    const fallback=new Date(file.lastModified);
    const date=captured || (Number.isFinite(fallback.getTime())?fallback:new Date());
    const latitude=typeof gps?.latitude==='number' ? gps.latitude
      :typeof exif?.latitude==='number'?exif.latitude:undefined;
    const longitude=typeof gps?.longitude==='number' ? gps.longitude
      :typeof exif?.longitude==='number'?exif.longitude:undefined;
    return {
      takenOn:localISO(date),
      takenTime:String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0'),
      dateSource:captured?'exif' as const:'file' as const,
      latitude,longitude
    };
  })();
  inspectionCache.set(file,inspection);
  return inspection;
}

export async function importPhoto(file:File,opts:ImportOptions):Promise<Photo> {
  if(file.size>60*1024*1024) throw new Error('Archivo de más de 60 MB: requiere importación desde el servidor.');
  if(!file.type.startsWith('image/') && !/\.(heic|heif|jpg|jpeg|png|webp|avif)$/i.test(file.name)){
    throw new Error('Solo se admiten imágenes en esta primera versión.');
  }
  const db=await database;
  const quota=await navigator.storage?.estimate?.().catch(()=>undefined);
  if(quota?.quota&&quota.usage&&quota.usage+file.size*2>quota.quota*0.90){
    throw new Error('No hay espacio suficiente para guardar la fotografía y su copia local con seguridad.');
  }
  // Deduplicación exacta; no modifica el archivo original.
  const bytes=await file.arrayBuffer();
  // subtle.digest requiere un contexto seguro; en HTTP doméstico mantenemos SHA-256 con JS.
  const hash=globalThis.crypto?.subtle
    ? Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('')
    : sha256(new Uint8Array(bytes));
  const existing=(await db.getAll('photos')).find(p=>p.hash===hash);
  if(existing) throw new Error('Esta fotografía ya está importada (archivo idéntico).');

  const inspected=await inspectPhoto(file);
  const takenOn=opts.overrideDate || inspected.takenOn;
  const takenTime=inspected.takenTime;
  const latitude=inspected.latitude;
  const longitude=inspected.longitude;
  const photo:Photo={
    id:createId(), filename:file.name,mimeType:file.type||'application/octet-stream',
    size:file.size, hash, takenOn, takenTime,
    dateSource:opts.overrideDate?'manual':inspected.dateSource,
    place:opts.place, latitude,longitude,
    memoryIds:opts.memoryId?[opts.memoryId]:[],
    subjectIds:opts.subjectIds, description:'',favorite:false,createdAt:new Date().toISOString()
  };
  const [preview,thumbnail]=await Promise.all([
    webpVariant(file,2560,0.82),webpVariant(file,360,0.72)
  ]);
  // Transacción única: nunca debe quedar una ficha sin su archivo original.
  const tx=db.transaction(['photos','assets','asset_sizes','operations'],'readwrite');
  await tx.objectStore('assets').put({key:photo.id+':original',blob:file});
  await tx.objectStore('asset_sizes').put({key:photo.id+':original',bytes:file.size});
  if(preview){await tx.objectStore('assets').put({key:photo.id+':preview',blob:preview});await tx.objectStore('asset_sizes').put({key:photo.id+':preview',bytes:preview.size});}
  if(thumbnail){await tx.objectStore('assets').put({key:photo.id+':thumb',blob:thumbnail});await tx.objectStore('asset_sizes').put({key:photo.id+':thumb',bytes:thumbnail.size});}
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

/** Base cartográfica optimizada del GeoTIFF EPSG:3857 proporcionado por el usuario. */
export async function getWorldMapImage():Promise<Blob|undefined>{
  return (await (await database).get('map_assets','georef-world'))?.blob;
}

export async function saveWorldMapImage(blob:Blob):Promise<void>{
  if(!['image/webp','image/png','image/jpeg'].includes(blob.type)){
    throw new Error('Selecciona la versión optimizada WebP/JPEG/PNG, no el TIFF original.');
  }
  if(blob.size>20*1024*1024)throw new Error('El mapa pesa demasiado. Utiliza la versión WebP optimizada.');
  const bitmap=await createImageBitmap(blob).catch(()=>undefined);
  if(!bitmap)throw new Error('No se pudo leer la imagen del mapa.');
  const ratio=bitmap.width/bitmap.height;
  bitmap.close();
  if(Math.abs(ratio-28740/27559)>0.018)throw new Error('Esta imagen no coincide con la proporción del mapa georreferenciado.');
  await (await database).put('map_assets',{key:'georef-world',blob});
}

export async function getLocalUsage():Promise<{bytes:number;quota?:number;usage?:number}>{
  const db=await database;
  // Evitar getAll('assets'): cargaría en memoria todos los blobs, que podrían ocupar gigabytes.
  const sizes=await db.getAll('asset_sizes');
  const bytes=sizes.length?sizes.reduce((sum,a)=>sum+a.bytes,0):(await db.getAll('photos')).reduce((sum,p)=>sum+p.size,0);
  const estimate=await navigator.storage?.estimate?.().catch(()=>undefined);
  return {bytes,quota:estimate?.quota,usage:estimate?.usage};
}

export async function requestPersistence():Promise<boolean>{
  return Boolean(await navigator.storage?.persist?.().catch(()=>false));
}
