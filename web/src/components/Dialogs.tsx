import { useEffect, useState, type ReactNode } from 'react';
import { Check, Heart, ImagePlus, MapPin, X } from 'lucide-react';
import type { ImportOptions, Memory, MemoryKind, Photo, Subject, SubjectKind } from '../types';
import { dateLabel, localISO } from '../dates';
import { PhotoView } from './PhotoView';

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

export function ImportDialog({memories,subjects,onClose,onCommit}:{
  memories:Memory[];subjects:Subject[];onClose:()=>void;
  onCommit:(files:File[],options:ImportOptions)=>Promise<{imported:number;errors:string[]}>;
}){
  const [files,setFiles]=useState<File[]>([]);
  const [overrideDate,setOverrideDate]=useState('');
  const [place,setPlace]=useState('');
  const [memoryId,setMemoryId]=useState('');
  const [selectedSubjects,setSelectedSubjects]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [errors,setErrors]=useState<string[]>([]);
  const [done,setDone]=useState(0);
  const [previews,setPreviews]=useState<string[]>([]);
  useEffect(()=>{
    const urls=files.slice(0,8).map(f=>URL.createObjectURL(f));
    setPreviews(urls);
    return ()=>urls.forEach(url=>URL.revokeObjectURL(url));
  },[files]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(!files.length||busy)return;
    setBusy(true);setErrors([]);
    try{
      const result=await onCommit(files,{overrideDate:overrideDate||undefined,place,memoryId:memoryId||undefined,subjectIds:selectedSubjects});
      setDone(result.imported);setErrors(result.errors);
      if(!result.errors.length)onClose();
    }catch(err){setErrors([String(err)]);}
    finally{setBusy(false);}
  }
  return <Dialog title="Importar fotografías" onClose={onClose} wide>
    <form onSubmit={submit} className="form-stack">
      <div className="import-steps"><span className="current">1. Seleccionar</span><span>2. Organizar</span><span>3. Guardar offline</span></div>
      <label className="upload-zone">
        <ImagePlus size={31}/><strong>{files.length?`${files.length} fotografías seleccionadas`:'Seleccionar fotografías'}</strong>
        <small>Puedes elegir varias imágenes a la vez. Se guardarán en este dispositivo, con su archivo original.</small>
        <input type="file" multiple accept="image/*,.heic,.heif" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
      </label>
      {files.length>0&&<div className="preview-row">{previews.map((url,i)=><img key={url} src={url} alt={files[i].name} onError={e=>{e.currentTarget.style.opacity='.25';}} />)}</div>}
      <div className="form-grid">
        <label className="field"><span>Corregir fecha (opcional)</span><input type="date" value={overrideDate} onChange={e=>setOverrideDate(e.target.value)}/><small>Si la dejas vacía, se utiliza EXIF o la fecha del archivo.</small></label>
        <label className="field"><span>Lugar (opcional)</span><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Barcelona, Roma..."/></label>
      </div>
      <label className="field"><span>Asignar a viaje, evento o momento</span>
        <select value={memoryId} onChange={e=>setMemoryId(e.target.value)}>
          <option value="">Sin recuerdo asociado</option>
          {memories.map(m=><option value={m.id} key={m.id}>{m.title} · {dateLabel(m.startDate,'short')}</option>)}
        </select>
      </label>
      <div className="field"><span>¿Quién aparece? Selecciona personas y animales</span>
        {subjects.length?<div className="chips">{subjects.map(s=><button type="button" key={s.id} className={'chip '+(selectedSubjects.includes(s.id)?'selected':'')} onClick={()=>setSelectedSubjects(v=>v.includes(s.id)?v.filter(x=>x!==s.id):[...v,s.id])}>{s.kind==='animal'?'🐾':'♡'} {s.name} {selectedSubjects.includes(s.id)&&<Check size={12}/>}</button>)}</div>:<small>Añade primero personas o mascotas desde su sección. Puedes etiquetar la foto más adelante.</small>}
      </div>
      <p className="helper-text">La aplicación detectará fechas y coordenadas EXIF cuando estén disponibles. No realizará reconocimiento facial automático. No hay todavía conexión con el servidor.</p>
      {done>0&&<p className="success-text">{done} fotografías guardadas en este dispositivo.</p>}
      {errors.length>0&&<div className="form-errors" role="alert">{errors.slice(0,8).map((e,i)=><p key={i}>{e}</p>)}</div>}
      <div className="form-actions"><button type="button" className="btn subtle" onClick={onClose}>Cerrar</button><button className="btn primary" disabled={!files.length||busy} type="submit">{busy?'Guardando fotografías...':`Importar ${files.length||''} fotos`}</button></div>
    </form>
  </Dialog>;
}

export function MemoryDialog({onClose,onSave,initial,defaultKind}:{
  onClose:()=>void;onSave:(memory:Memory)=>Promise<void>;initial?:Memory;defaultKind?:MemoryKind;
}){
  const [kind,setKind]=useState<MemoryKind>(initial?.kind||defaultKind||'moment');
  const [title,setTitle]=useState(initial?.title||'');
  const [description,setDescription]=useState(initial?.description||'');
  const [startDate,setStartDate]=useState(initial?.startDate||localISO(new Date()));
  const [endDate,setEndDate]=useState(initial?.endDate||localISO(new Date()));
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
      await onSave({id:initial?.id||crypto.randomUUID(),kind,title:title.trim(),description,
        startDate,endDate:actualEnd,place:place.trim(),
        latitude:lat?Number(lat):undefined,longitude:lon?Number(lon):undefined,
        favorite:initial?.favorite||false,coverPhotoId:initial?.coverPhotoId,createdAt:initial?.createdAt||new Date().toISOString()});
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

export function SubjectDialog({onClose,onSave}:{
  onClose:()=>void;onSave:(subject:Subject)=>Promise<void>;
}){
  const [kind,setKind]=useState<SubjectKind>('person');
  const [name,setName]=useState('');
  const [notes,setNotes]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{await onSave({id:crypto.randomUUID(),kind,name:name.trim(),notes});onClose();}
    catch(err){setError(String(err));}finally{setBusy(false);}
  }
  return <Dialog title="Añadir persona o mascota" onClose={onClose}>
    <form onSubmit={submit} className="form-stack">
      <div className="segmented"><button type="button" className={kind==='person'?'active':''} onClick={()=>setKind('person')}>Persona</button><button type="button" className={kind==='animal'?'active':''} onClick={()=>setKind('animal')}>Mascota</button></div>
      <label className="field"><span>Nombre</span><input required value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label>
      <label className="field"><span>Notas (opcional)</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label>
      {error&&<p className="form-errors">{error}</p>}
      <div className="form-actions"><button className="btn subtle" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy||!name.trim()}>Guardar</button></div>
    </form>
  </Dialog>;
}

export function PhotoDialog({photo,memories,subjects,onClose,onSave}:{
  photo:Photo;memories:Memory[];subjects:Subject[];onClose:()=>void;onSave:(p:Photo)=>Promise<void>;
}){
  const [draft,setDraft]=useState(photo);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
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
        <button type="button" className={'favorite-toggle '+(draft.favorite?'on':'')} onClick={()=>setDraft(v=>({...v,favorite:!v.favorite}))}><Heart size={20} fill={draft.favorite?'currentColor':'none'}/>{draft.favorite?'Favorita':'Marcar como favorita'}</button>
        {error&&<p className="form-errors">{error}</p>}
        <div className="form-actions"><button type="button" className="btn subtle" onClick={onClose}>Cerrar</button><button type="submit" className="btn primary" disabled={busy}>Guardar cambios</button></div>
      </div>
    </form>
  </Dialog>;
}
