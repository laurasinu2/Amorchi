import { useEffect, useState, type ReactNode } from 'react';
import { Check, Heart, ImagePlus, MapPin, Trash2, X } from 'lucide-react';
import type { AppSettings, Memory, MemoryKind, Photo, Subject, SubjectKind } from '../types';
import { celebrationCatalog, automaticCelebrationIds, overrideCelebration } from '../celebrations';
import { dateLabel, localISO } from '../dates';
import { PhotoView } from './PhotoView';
import { createId } from '../id';

export function Dialog({title,children,onClose,wide=false}:{
  title:string;children:ReactNode;onClose:()=>void;wide?:boolean;
}){
  useEffect(()=>{
    function key(e:KeyboardEvent){if(e.key==='Escape')onClose();}
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[onClose]);
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={title} className={'dialog '+(wide?'wide':'')}>
      <header className="dialog-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
      <div className="dialog-body">{children}</div>
    </section>
  </div>;
}

export function MemoryDialog({onClose,onSave,initial,defaultKind,initialDate}:{
  onClose:()=>void;onSave:(memory:Memory)=>Promise<void>;initial?:Memory;defaultKind?:MemoryKind;initialDate?:string;
}){
  const [kind,setKind]=useState<MemoryKind>(initial?.kind||defaultKind||'moment');
  const [title,setTitle]=useState(initial?.title||'');
  const [description,setDescription]=useState(initial?.description||'');
  const [startDate,setStartDate]=useState(initial?.startDate||initialDate||localISO(new Date()));
  const [endDate,setEndDate]=useState(initial?.endDate||initialDate||localISO(new Date()));
  const [place,setPlace]=useState(initial?.place||'');
  const [lat,setLat]=useState(initial?.latitude?.toString()||'');
  const [lon,setLon]=useState(initial?.longitude?.toString()||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');
    const actualEnd=kind==='moment'?startDate:endDate;
    if(actualEnd<startDate){setError('La fecha final no puede ser anterior a la inicial.');return;}
    if((lat&&!lon)||(!lat&&lon)){setError('Indica latitud y longitud juntas, o deja ambas vacías.');return;}
    if(lat&&(Number(lat)<-90||Number(lat)>90||Number(lon)<-180||Number(lon)>180)){setError('Las coordenadas están fuera del rango válido.');return;}
    setBusy(true);
    try{
      await onSave({id:initial?.id||createId(),kind,title:title.trim(),description,
        startDate,endDate:actualEnd,place:place.trim(),
        latitude:lat?Number(lat):undefined,longitude:lon?Number(lon):undefined,
        favorite:initial?.favorite||false,coverPhotoId:initial?.coverPhotoId,coverPosition:initial?.coverPosition,createdAt:initial?.createdAt||new Date().toISOString()});
      onClose();
    }catch(err){setError(String(err));}
    finally{setBusy(false);}
  }
  return <Dialog title={initial?'Editar recuerdo':'Crear recuerdo'} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <div className="segmented">{(['moment','event','trip'] as MemoryKind[]).map(k=><button type="button" key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k==='moment'?'♡ Momento':k==='event'?'✦ Evento':'✈ Viaje'}</button>)}</div>
      <label className="field"><span>Nombre</span><input required maxLength={110} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nuestra primera escapada"/></label>
      <div className="form-grid">
        <label className="field"><span>{kind==='moment'?'Fecha':'Fecha de inicio'}</span><input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
        {kind!=='moment'&&<label className="field"><span>Fecha final</span><input type="date" required value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>}
      </div>
      <label className="field"><span>Lugar principal</span><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Lisboa, Portugal"/></label>
      <div className="form-grid">
        <label className="field"><span>Latitud (opcional)</span><input type="number" step="any" min="-90" max="90" placeholder="41.3874" value={lat} onChange={e=>setLat(e.target.value)}/></label>
        <label className="field"><span>Longitud (opcional)</span><input type="number" step="any" min="-180" max="180" placeholder="2.1686" value={lon} onChange={e=>setLon(e.target.value)}/></label>
      </div>
      <small className="helper-text"><MapPin size={13}/> Solo los recuerdos con coordenadas aparecerán como marcadores en el mapa mundial.</small>
      <label className="field"><span>Descripción</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="¿Qué queréis recordar de ese día?"/></label>
      {error&&<p className="form-errors" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="btn subtle" onClick={onClose}>Cancelar</button><button type="submit" className="btn primary" disabled={busy||!title.trim()}>{busy?'Guardando...':'Guardar recuerdo'}</button></div>
    </form>
  </Dialog>;
}

export function SubjectDialog({onClose,onSave,photos,initial}:{
  onClose:()=>void;onSave:(subject:Subject)=>Promise<void>;
  photos:Photo[];initial?:Subject;
}){
  const [kind,setKind]=useState<SubjectKind>(initial?.kind||'person');
  const [name,setName]=useState(initial?.name||'');
  const [notes,setNotes]=useState(initial?.notes||'');
  const [avatarPhotoId,setAvatarPhotoId]=useState(initial?.avatarPhotoId||'');
  const [showPhotos,setShowPhotos]=useState(false);
  const [photoSearch,setPhotoSearch]=useState('');
  const avatarChoices=[...photos].filter(p=>[p.filename,p.takenOn,p.place].join(' ').toLowerCase().includes(photoSearch.toLowerCase()))
    .sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt)).slice(0,64);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{await onSave({id:initial?.id||createId(),kind,name:name.trim(),notes,avatarPhotoId:avatarPhotoId||undefined});onClose();}
    catch(err){setError(String(err));}finally{setBusy(false);}
  }
  return <Dialog title={initial?'Editar persona o mascota':'Añadir persona o mascota'} onClose={onClose}>
    <form onSubmit={submit} className="form-stack">
      <div className="segmented"><button type="button" className={kind==='person'?'active':''} onClick={()=>setKind('person')}>Persona</button><button type="button" className={kind==='animal'?'active':''} onClick={()=>setKind('animal')}>Mascota</button></div>
      <label className="field"><span>Nombre</span><input required value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label>
      <label className="field"><span>Notas (opcional)</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label>
      <div className="memrly-avatar-editor">
        <div className="memrly-avatar-editor-preview">{avatarPhotoId?<PhotoView id={avatarPhotoId} className="memrly-avatar-editor-photo"/>:kind==='animal'?'🐾':'♡'}</div>
        <div><strong>Foto de perfil</strong><small>Usa una fotografía existente, sin duplicarla.</small>
          <button type="button" className="btn subtle" onClick={()=>setShowPhotos(v=>!v)}>{showPhotos?'Cerrar selección':'Elegir fotografía'}</button>
          {avatarPhotoId&&<button type="button" className="memrly-avatar-clear" onClick={()=>setAvatarPhotoId('')}>Quitar foto</button>}
        </div>
      </div>
      {showPhotos&&<div className="memrly-avatar-pick">
        <input aria-label="Buscar foto de perfil" placeholder="Buscar por fecha, lugar o nombre…" value={photoSearch} onChange={e=>setPhotoSearch(e.target.value)}/>
        <div className="memrly-avatar-grid">
          {avatarChoices.map(p=><PhotoView key={p.id} id={p.id} className={'memrly-avatar-choice'+(avatarPhotoId===p.id?' chosen':'')} onClick={()=>{setAvatarPhotoId(p.id);setShowPhotos(false);}}/>)}
        </div>
        <small>Mostrando hasta 64 resultados; busca para encontrar fotografías anteriores.</small>
      </div>}
      {error&&<p className="form-errors">{error}</p>}
      <div className="form-actions"><button className="btn subtle" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy||!name.trim()}>Guardar</button></div>
    </form>
  </Dialog>;
}


/** Confirmación específica para eliminar viajes, eventos y momentos sin borrar fotos. */
export function MemoryDeleteDialog({memory,photoCount,onClose,onConfirm}:{
  memory:Memory;photoCount:number;onClose:()=>void;onConfirm:()=>Promise<void>;
}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const noun=memory.kind==='trip'?'viaje':memory.kind==='event'?'evento':'momento';
  async function confirm(){
    if(busy)return;
    setBusy(true);setError('');
    try{await onConfirm();}catch(err){
      setError(err instanceof Error?err.message:String(err));
      setBusy(false);
    }
  }
  return <Dialog title={`Eliminar ${noun}`} onClose={()=>{if(!busy)onClose();}}>
    <div className="form-stack">
      <div className="delete-confirmation">
        <strong>¿Seguro que quieres eliminar este {noun}?</strong>
        <p><b>{memory.title}</b></p>
        <p>Se eliminará su ficha, sus fechas y su marcador del mapa. No se podrá deshacer.</p>
      </div>
      <p className="memory-delete-photos-note"><ImagePlus size={18}/>
        {photoCount===0?'No hay fotografías vinculadas a este recuerdo.':
        `Las ${photoCount} ${photoCount===1?'fotografía vinculada':'fotografías vinculadas'} NO se eliminarán. Seguirán disponibles en el álbum y en cualquier otro recuerdo al que pertenezcan.`}
      </p>
      {error&&<p className="form-errors" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn subtle" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="btn danger" onClick={confirm} disabled={busy}><Trash2 size={16}/>{busy?'Eliminando…':`Sí, eliminar ${noun}`}</button>
      </div>
    </div>
  </Dialog>;
}

export function PhotoDialog({photo,memories,subjects,settings,onClose,onSave,onDelete}:{
  photo:Photo;memories:Memory[];subjects:Subject[];settings:AppSettings;onClose:()=>void;onSave:(p:Photo)=>Promise<void>;onDelete:(id:string)=>Promise<void>;
}){
  const [draft,setDraft]=useState(photo);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [newCelebrationId,setNewCelebrationId]=useState('');
  const catalog=celebrationCatalog(settings);
  const automatically=new Set(automaticCelebrationIds(draft.takenOn,settings));
  const associated=catalog.filter(c=>automatically.has(c.id)||(draft.celebrationIncludeIds||[]).includes(c.id)||(draft.celebrationExcludeIds||[]).includes(c.id));
  const unassociated=catalog.filter(c=>!associated.some(x=>x.id===c.id));
  async function deleteConfirmed(){
    setError('');setBusy(true);
    try{await onDelete(photo.id);onClose();}
    catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setBusy(false);}
  }
  useEffect(()=>setDraft(photo),[photo]);
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{await onSave(draft);onClose();}catch(err){setError(String(err));}finally{setBusy(false);}
  }
  return <Dialog title={photo.filename} onClose={onClose} wide>
    <form onSubmit={submit} className="photo-editor">
      <PhotoView id={photo.id} quality="preview" className="editor-photo"/>
      <div className="form-stack">
        <div className="editor-meta"><strong>{dateLabel(draft.takenOn)}</strong><small>Origen de la fecha: {draft.dateSource==='exif'?'EXIF':draft.dateSource==='file'?'archivo':'manual'}</small>{photo.latitude!==undefined&&<small>GPS EXIF: {photo.latitude.toFixed(5)}, {photo.longitude?.toFixed(5)}</small>}</div>
        <div className="form-grid">
          <label className="field"><span>Fecha</span><input type="date" value={draft.takenOn} onChange={e=>setDraft(v=>({...v,takenOn:e.target.value,dateSource:'manual'}))} required/></label>
          <label className="field"><span>Lugar</span><input value={draft.place} onChange={e=>setDraft(v=>({...v,place:e.target.value}))}/></label>
        </div>
        <label className="field"><span>Descripción</span><textarea rows={3} value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))}/></label>
        <div className="field"><span>Asociar a recuerdos (puedes elegir varios)</span>
          <div className="chips">{memories.length?memories.map(m=><button key={m.id} type="button" className={'chip '+(draft.memoryIds.includes(m.id)?'selected':'')} onClick={()=>setDraft(v=>({...v,memoryIds:v.memoryIds.includes(m.id)?v.memoryIds.filter(id=>id!==m.id):[...v.memoryIds,m.id]}))}>{m.title}</button>):<small>Aún no hay recuerdos creados.</small>}</div>
        </div>
        <div className="field"><span>Personas y mascotas</span>
          <div className="chips">{subjects.length?subjects.map(s=><button key={s.id} type="button" className={'chip '+(draft.subjectIds.includes(s.id)?'selected':'')} onClick={()=>setDraft(v=>({...v,subjectIds:v.subjectIds.includes(s.id)?v.subjectIds.filter(id=>id!==s.id):[...v.subjectIds,s.id]}))}>{s.kind==='animal'?'🐾':'♡'} {s.name}</button>):<small>Añade personas o mascotas desde su sección.</small>}</div>
        </div>
        <section className="celebration-associations" aria-label="Celebraciones de la fotografía">
          <div className="celebration-associations-title">
            <strong>Celebraciones y fechas especiales</strong>
            <small>Por fecha aparecen automáticamente. Puedes incluir anticipadas o excluir coincidencias sin afectar a viajes y recuerdos.</small>
          </div>
          {associated.length?<div className="celebration-editor-rows">{associated.map(c=>{
            const mode=(draft.celebrationExcludeIds||[]).includes(c.id)?'exclude':
              (draft.celebrationIncludeIds||[]).includes(c.id)?'include':'auto';
            return <label className="celebration-editor-row" key={c.id}>
              <span><strong>{c.title}</strong><small>{automatically.has(c.id)?'Coincide con la fecha':'Asociación manual'}</small></span>
              <select aria-label={'Asociación de '+c.title} value={mode} onChange={e=>setDraft(v=>overrideCelebration(v,c.id,e.target.value as 'auto'|'include'|'exclude'))}>
                <option value="auto">{automatically.has(c.id)?'Automática por fecha':'Sin asociación'}</option>
                <option value="include">Incluir manualmente</option>
                <option value="exclude">Excluir de la celebración</option>
              </select>
            </label>;
          })}</div>:<p className="helper-text">No hay celebraciones automáticas para esta fecha.</p>}
          {unassociated.length>0&&<div className="celebration-add-row">
            <select value={newCelebrationId} aria-label="Elegir celebración" onChange={e=>setNewCelebrationId(e.target.value)}>
              <option value="">Elegir otra celebración</option>
              {unassociated.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button type="button" className="btn subtle" disabled={!newCelebrationId} onClick={()=>{
              if(!newCelebrationId)return;
              setDraft(v=>overrideCelebration(v,newCelebrationId,'include'));
              setNewCelebrationId('');
            }}>Añadir</button>
          </div>}
        </section>
        <button type="button" className={'favorite-toggle '+(draft.favorite?'on':'')} onClick={()=>setDraft(v=>({...v,favorite:!v.favorite}))}><Heart size={20} fill={draft.favorite?'currentColor':'none'}/>{draft.favorite?'Favorita':'Marcar como favorita'}</button>
        {error&&<p className="form-errors">{error}</p>}
        {confirmDelete&&<div className="delete-confirmation" role="alertdialog" aria-label="Confirmar eliminación de fotografía">
          <strong>¿Seguro que quieres eliminar esta fotografía?</strong>
          <p>Se eliminará el archivo original, las miniaturas y sus asociaciones locales. No se puede deshacer.</p>
          <div className="form-actions"><button className="btn subtle" type="button" disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancelar</button><button className="btn danger" type="button" disabled={busy} onClick={deleteConfirmed}>{busy?'Eliminando…':'Sí, eliminar definitivamente'}</button></div>
        </div>}
        {!confirmDelete&&<div className="form-actions photo-actions"><button type="button" className="btn danger-outline" disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={16}/> Eliminar fotografía</button><span className="photo-actions-spacer"/><button type="button" className="btn subtle" onClick={onClose}>Cerrar</button><button type="submit" className="btn primary" disabled={busy}>Guardar cambios</button></div>}
      </div>
    </form>
  </Dialog>;
}

export { ImportDialog } from './Importer';
