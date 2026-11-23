import { inspectPhoto, getPhotoAsset, loadLibrary } from './db';
import { createId } from './id';
import type { AppSettings, ImportOptions, Memory, Photo, PhotoCollection, Subject } from './types';
import { defaultSettings } from './types';

type RemotePhoto={id:string;metadata:Photo;filename:string;size:number;sha256:string};
type RemoteEntities={memory:Memory[];subject:Subject[];collection:PhotoCollection[];settings:AppSettings[]};
let activeToken:string|null=null;
// Short-lived RAM cache only. No originals or previews are persisted on disk.
const previewCache=new Map<string,Blob>();
const previewsLoading=new Map<string,Promise<Blob>>();
let previewBytes=0;
export function setOnlinePhotoToken(token:string|null){
  if(activeToken!==token){
    previewCache.clear();previewsLoading.clear();previewBytes=0;
  }
  activeToken=token;
}

async function request(path:string,token:string,init:RequestInit={}):Promise<Response>{
  let response:Response;
  try{
    response=await fetch('/api/v1/'+path,{
      ...init,
      headers:{...init.headers,Authorization:'Bearer '+token},
      credentials:'same-origin',
      cache:'no-store'
    });
  }catch{
    throw new Error('No se pudo conectar con el servidor. Comprueba tu conexión.');
  }
  if(!response.ok){
    let message='El servidor ha devuelto '+response.status+'.';
    try{const body=await response.json() as {detail?:string};if(body.detail)message=body.detail;}
    catch{/* generic message */}
    throw new Error(message);
  }
  return response;
}
async function json<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
  return await (await request(path,token,init)).json() as T;
}
export async function listOnlinePhotos(token:string):Promise<RemotePhoto[]>{
  const all:RemotePhoto[]=[];
  for(let offset=0;offset<=100000;offset+=200){
    const batch=await json<RemotePhoto[]>('sync/photos?limit=200&offset='+offset,token);
    all.push(...batch);
    if(batch.length<200)return all;
  }
  throw new Error('Demasiadas fotografías para este listado.');
}
export async function loadOnlineLibrary(token:string){
  const [remote,entities]=await Promise.all([
    listOnlinePhotos(token),
    json<RemoteEntities>('library/entities',token)
  ]);
  return {
    photos:remote.map(r=>({...r.metadata,id:r.id,filename:r.filename,size:r.size,hash:r.sha256})),
    memories:entities.memory,
    subjects:entities.subject,
    collections:entities.collection,
    settings:entities.settings.find(x=>x.id==='main')||defaultSettings
  };
}
export async function uploadOnlinePhoto(file:File,opts:ImportOptions,token:string):Promise<Photo>{
  if(file.size>25*1024*1024)
    throw new Error('Este archivo supera los 25 MB permitidos por el servidor.');
  const examined=await inspectPhoto(file);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())))
    .map(v=>v.toString(16).padStart(2,'0')).join('');
  const mime=file.type||(/\.heic$/i.test(file.name)?'image/heic':/\.heif$/i.test(file.name)?'image/heif':/\.avif$/i.test(file.name)?'image/avif':/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'image/jpeg');
  const photo:Photo={
    id:createId(),filename:file.name,mimeType:mime,size:file.size,hash,
    takenOn:opts.overrideDate||examined.takenOn,takenTime:examined.takenTime,
    dateSource:opts.overrideDate?'manual':examined.dateSource,
    place:opts.place||'',latitude:opts.latitude??examined.latitude,
    longitude:opts.longitude??examined.longitude,
    memoryIds:opts.memoryId?[opts.memoryId]:[],subjectIds:opts.subjectIds,
    description:'',favorite:false,createdAt:new Date().toISOString()
  };
  await sendOnlinePhoto(photo,file,token);
  return photo;
}
async function sendOnlinePhoto(photo:Photo,file:Blob,token:string){
  const body=new FormData();
  body.append('photo_id',photo.id);
  body.append('metadata',JSON.stringify(photo));
  body.append('file',file,photo.filename);
  const receipt=await json<RemotePhoto>('sync/photos',token,{method:'POST',body});
  if(receipt.sha256!==photo.hash)throw new Error('El servidor no confirmó la integridad de '+photo.filename);
}
export async function updateOnlinePhoto(photo:Photo,token:string){
  await json('sync/photos/'+encodeURIComponent(photo.id)+'/metadata',token,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({metadata:photo})
  });
}
export async function deleteOnlinePhoto(id:string,token:string){
  await json('sync/photos/'+encodeURIComponent(id),token,{method:'DELETE'});
}
export async function saveOnlineEntity(kind:'memory'|'subject'|'collection'|'settings',id:string,payload:object,token:string){
  await json('library/entities/'+kind+'/'+encodeURIComponent(id),token,{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
  });
}
export async function deleteOnlineEntity(kind:'memory'|'subject'|'collection',id:string,token:string){
  await json('library/entities/'+kind+'/'+encodeURIComponent(id),token,{method:'DELETE'});
}
export async function getOnlinePhotoBlob(id:string,quality:'thumb'|'preview'|'original'='thumb'):Promise<Blob>{
  const token=activeToken;
  if(!token)throw new Error('Debes iniciar sesión para ver las fotografías.');
  const kind=quality==='original'?'file':'preview?size='+(quality==='thumb'?360:1280);
  if(quality==='original')
    return await (await request('sync/photos/'+encodeURIComponent(id)+'/'+kind,token)).blob();
  const key=id+'|'+quality;
  const existing=previewCache.get(key);
  if(existing){
    previewCache.delete(key);previewCache.set(key,existing);
    return existing;
  }
  const active=previewsLoading.get(key);
  if(active)return active;
  const task=(async()=>{
    const blob=await (await request('sync/photos/'+encodeURIComponent(id)+'/'+kind,token)).blob();
    if(activeToken===token&&blob.size<5*1024*1024){
      const old=previewCache.get(key);
      if(old)previewBytes-=old.size;
      previewCache.delete(key);previewCache.set(key,blob);previewBytes+=blob.size;
      while(previewBytes>32*1024*1024||previewCache.size>100){
        const oldest=previewCache.keys().next().value;
        if(oldest===undefined)break;
        previewBytes-=previewCache.get(oldest)!.size;
        previewCache.delete(oldest);
      }
    }
    return blob;
  })().finally(()=>{previewsLoading.delete(key);});
  previewsLoading.set(key,task);
  return task;
}

/** Existing browser-only photos require a one-time deliberate rescue; new photos never use IndexedDB. */
export async function countLegacyPhotos():Promise<number>{
  return (await loadLibrary()).photos.length;
}
export async function rescueLegacyLibrary(token:string,accountId:string,progress:(message:string)=>void){
  const owner=localStorage.getItem('memrly-photo-sync-owner');
  if(owner&&owner!==accountId)throw new Error('Estos datos locales pertenecen a otra cuenta.');
  const old=await loadLibrary();
  const current=await listOnlinePhotos(token);
  const knownIds=new Set(current.map(x=>x.id));
  const knownHashes=new Set(current.map(x=>x.sha256));
  let imported=0,skipped=0;
  // Never delete browser originals: old client-only libraries must remain recoverable.
  for(const photo of old.photos){
    progress('Recuperando '+photo.filename+' ('+(imported+skipped+1)+'/'+old.photos.length+')');
    if(knownIds.has(photo.id)||knownHashes.has(photo.hash)){skipped++;continue;}
    const blob=await getPhotoAsset(photo.id,'original');
    if(!blob)throw new Error('Falta el original local de '+photo.filename);
    await sendOnlinePhoto(photo,blob,token);
    knownIds.add(photo.id);knownHashes.add(photo.hash);imported++;
  }
  const entities=await json<RemoteEntities>('library/entities',token);
  const remoteId={memory:new Set(entities.memory.map(x=>x.id)),subject:new Set(entities.subject.map(x=>x.id)),
    collection:new Set(entities.collection.map(x=>x.id)),settings:new Set(entities.settings.map(x=>x.id))};
  for(const item of old.memories)if(!remoteId.memory.has(item.id))
    await saveOnlineEntity('memory',item.id,item,token);
  for(const item of old.subjects)if(!remoteId.subject.has(item.id))
    await saveOnlineEntity('subject',item.id,item,token);
  for(const item of old.collections)if(!remoteId.collection.has(item.id))
    await saveOnlineEntity('collection',item.id,item,token);
  if(!remoteId.settings.has('main')&&old.settings)
    await saveOnlineEntity('settings','main',old.settings,token);
  localStorage.setItem('memrly-photo-sync-owner',accountId);
  return {imported,skipped};
}
