import { useState, type FormEvent } from 'react';
import { ArrowRight, FolderPlus, Images, Plus, X } from 'lucide-react';
import type { Photo, PhotoCollection } from '../types';
import { createId } from '../id';
import { dateLabel, localISO } from '../dates';
import { PhotoView } from './PhotoView';

export function AddToCollectionDialog({date,photos,collections,onSave,onClose}:{
  date:string;photos:Photo[];collections:PhotoCollection[];
  onSave:(collection:PhotoCollection)=>Promise<void>;onClose:()=>void;
}){
  const [choice,setChoice]=useState('__new');
  const [title,setTitle]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const dayPhotos=photos.filter(p=>p.takenOn===date);
  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy||dayPhotos.length===0)return;
    const ids=dayPhotos.map(p=>p.id);
    const existing=collections.find(c=>c.id===choice);
    if(!existing&&!title.trim()){setError('Escribe un nombre para la nueva colección.');return;}
    const collection:PhotoCollection=existing
      ? {...existing,photoIds:[...new Set([...existing.photoIds,...ids])]}
      : {id:createId(),title:title.trim(),photoIds:ids,createdAt:new Date().toISOString()};
    setBusy(true);setError('');
    try{await onSave(collection);onClose();}catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
  }
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section className="dialog" role="dialog" aria-modal="true" aria-label="Añadir fotos a una colección">
      <header className="dialog-header"><h2>Guardar en colección</h2><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose} disabled={busy}><X size={20}/></button></header>
      <div className="dialog-body">
        <form className="form-stack" onSubmit={submit}>
          <p className="muted-text">{dateLabel(date)} · {dayPhotos.length} fotografías</p>
          {dayPhotos.length===0?<p className="helper-text">No hay fotografías en esta fecha. Importa algunas antes de añadirlas a una colección.</p>:<>
            <div className="collection-day-preview">{dayPhotos.slice(0,5).map(p=><PhotoView key={p.id} id={p.id} className="collection-mini-photo"/>)}</div>
            <label className="field"><span>Seleccionar colección</span><select value={choice} onChange={e=>setChoice(e.target.value)}>
              <option value="__new">+ Crear nueva colección</option>
              {collections.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}
            </select></label>
            {choice==='__new'&&<label className="field"><span>Nombre</span><input maxLength={100} placeholder="Nuestros atardeceres" value={title} onChange={e=>setTitle(e.target.value)} required/></label>}
          </>}
          {error&&<p role="alert" className="form-errors">{error}</p>}
          <div className="form-actions"><button type="button" className="btn subtle" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="btn primary" disabled={busy||dayPhotos.length===0}><FolderPlus size={16}/>{busy?'Guardando…':'Guardar fotografías'}</button></div>
        </form>
      </div>
    </section>
  </div>;
}

export function CollectionsPage({collections,photos,onView,onCreate}:{
  collections:PhotoCollection[];photos:Photo[];onView:(id:string)=>void;onCreate:(date:string)=>void;
}){
  const [chosen,setChosen]=useState<string|undefined>();
  const current=collections.find(c=>c.id===chosen);
  const collectionPhotos=current?photos.filter(p=>current.photoIds.includes(p.id)):[];
  return <div className="page-stack"><div className="page-intro"><h1>Colecciones</h1><p>Organiza tus fotografías por temas, sin duplicarlas.</p></div>
    {collections.length?<div className="collection-cards">{collections.map(c=>{
      const cover=photos.find(p=>c.photoIds.includes(p.id));
      return <button type="button" key={c.id} className={'collection-card '+(chosen===c.id?'active':'')} onClick={()=>setChosen(c.id)}>
        {cover?<PhotoView id={cover.id} className="collection-card-image"/>:<div className="collection-card-image placeholder"><Images size={30}/></div>}
        <span><strong>{c.title}</strong><small>{c.photoIds.filter(id=>photos.some(p=>p.id===id)).length} fotografías</small></span><ArrowRight size={18}/>
      </button>;
    })}</div>:<div className="empty-state"><Images size={28}/><h3>No hay colecciones todavía</h3><p>Ve al calendario, selecciona un día con fotografías y pulsa «Añadir a colección».</p></div>}
    {current&&<div className="panel collection-detail"><div className="section-title"><h2>{current.title}</h2><button className="text-link" onClick={()=>setChosen(undefined)}>Cerrar</button></div>
      <div className="photo-gallery">{collectionPhotos.map(p=><PhotoView key={p.id} id={p.id} className="gallery-photo" onClick={()=>onView(p.id)}/>)}</div>
      {!collectionPhotos.length&&<p className="muted-text">Esta colección no contiene fotografías disponibles.</p>}
    </div>}
    <p className="helper-text">Para añadir fotografías a una colección existente, selecciona una fecha en el calendario y utiliza «Añadir a colección».</p>
    <button type="button" className="btn subtle collection-from-today" onClick={()=>onCreate(localISO(new Date()))}><Plus size={16}/> Añadir fotos de hoy a una colección</button>
  </div>;
}
