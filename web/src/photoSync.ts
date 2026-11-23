import type { Photo, LocalOperation } from './types';
import { getPhotoAsset, loadLibrary, restoreRemotePhoto, acknowledgePhotoOperations, applyRemotePhotoMetadata } from './db';

const PREFIX='/api/v1/sync';
export type SyncProgress={done:number;total:number;stage:string};
type RemotePhoto={id:string;metadata:Photo;filename:string;size:number;sha256:string};
function authError(response:Response){if(response.status===401)return 'La sesión ha caducado. Vuelve a iniciar sesión.';return 'Error HTTP '+response.status;}
async function call<T>(path:string,token:string,init?:RequestInit):Promise<T>{
  const response=await fetch(PREFIX+path,{...init,credentials:'same-origin',cache:'no-store',
    headers:{...init?.headers,Authorization:'Bearer '+token}});
  if(!response.ok){
    let message=authError(response);
    try{const body=await response.json() as {detail?:string};if(body.detail)message=body.detail;}catch{/* non-JSON */}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
async function remoteList(token:string):Promise<RemotePhoto[]>{
  const all:RemotePhoto[]=[];
  for(let offset=0;offset<=100000;offset+=200){
    const batch=await call<RemotePhoto[]>('/photos?limit=200&offset='+offset,token);
    all.push(...batch);
    if(batch.length<200)return all;
  }
  throw new Error('Se superó el límite de paginación; contacta con soporte antes de sincronizar.');
}
function savedOwner(){try{return localStorage.getItem('memrly-photo-sync-owner');}catch{return null;}}
function rememberOwner(userId:string){try{localStorage.setItem('memrly-photo-sync-owner',userId);}catch{/* unavailable */}}
export function canSyncAccount(userId:string):boolean{
  const owner=savedOwner();
  return !owner||owner===userId;
}
/** Explicit user-driven sync, never automatically uploads an unrelated browser's photos. */
export async function synchronizePhotos(userId:string,token:string,onProgress:(progress:SyncProgress)=>void){
  const owner=savedOwner();
  if(owner&&owner!==userId){
    throw new Error('Esta biblioteca local se vinculó a otra cuenta. Usa un perfil de navegador separado para evitar compartir fotografías entre cuentas.');
  }
  const local=await loadLibrary();
  // The user must explicitly start the first synchronization from the settings page.
  const originalMap=new Map(local.photos.map(p=>[p.id,p]));
  const operations=local.operations.filter(o=>o.entity==='photo');
  const pendingById=new Map<string,LocalOperation[]>();
  for(const op of operations){
    if(!pendingById.has(op.entityId))pendingById.set(op.entityId,[]);
    pendingById.get(op.entityId)!.push(op);
  }
  const remote=await remoteList(token);
  // Bind this browser library before transferring the first byte, even if a later request fails.
  rememberOwner(userId);
  const remoteIds=new Set(remote.map(p=>p.id));
  const upload=local.photos.filter(p=>!remoteIds.has(p.id));
  const update=local.photos.filter(p=>remoteIds.has(p.id)&&pendingById.get(p.id)?.some(op=>op.type==='upsert'));
  // A pending local delete is intentionally NOT resurrected from the server.
  // Remote deletions are not sent in this first safe release.
  const deletedHere=new Set(operations.filter(op=>op.type==='delete').map(op=>op.entityId));
  const download=remote.filter(p=>!originalMap.has(p.id)&&!deletedHere.has(p.id));
  const cleanLocal=remote.filter(p=>originalMap.has(p.id)&&!pendingById.get(p.id)?.some(op=>op.type==='upsert'||op.type==='delete'));
  const total=upload.length+update.length+download.length+cleanLocal.length;
  let done=0;
  const progress=(stage:string)=>onProgress({done,total,stage});
  progress('Preparando fotografías');
  // Upload before download. Never purge the local original after a successful transfer.
  for(const photo of upload){
    progress('Subiendo '+photo.filename);
    const blob=await getPhotoAsset(photo.id,'original');
    if(!blob)throw new Error('Falta el original local de '+photo.filename+'. No se ha eliminado ninguna copia.');
    const file=new File([blob],photo.filename,{type:photo.mimeType||blob.type});
    const data=new FormData();
    data.append('photo_id',photo.id);
    data.append('metadata',JSON.stringify(photo));
    data.append('file',file);
    const receipt=await call<RemotePhoto>('/photos',token,{method:'POST',body:data});
    if(receipt.sha256 && receipt.sha256!==photo.hash){
      throw new Error('La copia remota no corresponde al original local de '+photo.filename+'. No se ha marcado como sincronizada.');
    }
    const matching=(pendingById.get(photo.id)||[]).filter(o=>o.type==='upsert');
    if(matching.length)await acknowledgePhotoOperations(matching.map(o=>o.id));
    done++;progress('Original subido');
  }
  for(const photo of update){
    progress('Actualizando datos de '+photo.filename);
    await call('/photos/'+encodeURIComponent(photo.id)+'/metadata',token,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({metadata:photo})
    });
    const matching=(pendingById.get(photo.id)||[]).filter(o=>o.type==='upsert');
    if(matching.length)await acknowledgePhotoOperations(matching.map(o=>o.id));
    done++;progress('Metadatos sincronizados');
  }
  for(const photo of download){
    progress('Recuperando '+photo.filename);
    const response=await fetch(PREFIX+'/photos/'+encodeURIComponent(photo.id)+'/file',{
      headers:{Authorization:'Bearer '+token},credentials:'same-origin',cache:'no-store'
    });
    if(!response.ok)throw new Error('No se pudo recuperar '+photo.filename+': '+authError(response));
    const blob=await response.blob();
    if(!blob.size||blob.size>100*1024*1024||blob.size!==photo.size)
      throw new Error('El original remoto tiene un tamaño incorrecto: '+photo.filename);
    if(photo.sha256 && globalThis.crypto?.subtle){
      const sum=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      const hash=[...new Uint8Array(sum)].map(value=>value.toString(16).padStart(2,'0')).join('');
      if(hash!==photo.sha256)throw new Error('La verificación SHA-256 falló para '+photo.filename);
    }
    await restoreRemotePhoto(photo.metadata,blob);
    done++;progress('Original recuperado');
  }
  for(const photo of cleanLocal){
    progress('Actualizando ficha local de '+photo.filename);
    await applyRemotePhotoMetadata(photo.metadata);
    done++;progress('Ficha actualizada');
  }
  progress('Sincronización completada');
  return {uploaded:upload.length,updated:update.length,downloaded:download.length,refreshed:cleanLocal.length,total};
}
