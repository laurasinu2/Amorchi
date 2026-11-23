import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Camera, Heart, Link2, MapPin, Plane, X } from 'lucide-react';
import type { Memory, MemoryKind, Photo } from '../types';
import { dateLabel, localISO } from '../dates';
import { createId } from '../id';
import { PhotoView } from './PhotoView';
import { LocationSearch } from './LocationSearch';
import './memory-editor.css';

export function MemoryDialog({onClose,onSave,initial,defaultKind,initialDate,initialEndDate,memories,photos}:{
  onClose:()=>void;onSave:(memory:Memory)=>Promise<void>;initial?:Memory;defaultKind?:MemoryKind;
  initialDate?:string;initialEndDate?:string;memories:Memory[];photos:Photo[];
}){
  const [kind,setKind]=useState<MemoryKind>(initial?.kind||defaultKind||(initialEndDate&&initialDate!==initialEndDate?'event':'moment'));
  const [title,setTitle]=useState(initial?.title||'');
  const [description,setDescription]=useState(initial?.description||'');
  const [startDate,setStartDate]=useState(initial?.startDate||initialDate||localISO(new Date()));
  const [endDate,setEndDate]=useState(initial?.endDate||initialEndDate||initialDate||localISO(new Date()));
  const [place,setPlace]=useState(initial?.place||'');
  const [latitude,setLatitude]=useState<number|undefined>(initial?.latitude);
  const [longitude,setLongitude]=useState<number|undefined>(initial?.longitude);
  const [related,setRelated]=useState<string[]>(initial?.relatedMemoryIds||[]);
  const [coverId,setCoverId]=useState(initial?.coverPhotoId||'');
  const [chooseCover,setChooseCover]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){if(chooseCover)setChooseCover(false);else onClose();}};
    window.addEventListener('keydown',esc);
    return ()=>window.removeEventListener('keydown',esc);
  },[onClose,busy,chooseCover]);
  const effectiveEnd=kind==='moment'?startDate:endDate;
  const candidates=memories.filter(memory=>memory.id!==initial?.id && memory.startDate<=effectiveEnd && memory.endDate>=startDate);
  const selectedRelated=memories.filter(memory=>related.includes(memory.id));
  function selectRelated(id:string){setRelated(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    if(!title.trim()){setError('Indica un nombre.');return;}
    if(!startDate||!effectiveEnd||effectiveEnd<startDate){setError('La fecha final no puede ser anterior a la inicial.');return;}
    setBusy(true);
    try{
      await onSave({
        id:initial?.id||createId(),title:title.trim(),description,kind,startDate,endDate:effectiveEnd,
        place:place.trim(),latitude,longitude,
        relatedMemoryIds:related,coverPhotoId:coverId||undefined,
        coverPosition:coverId===initial?.coverPhotoId?initial?.coverPosition:undefined,
        favorite:initial?.favorite||false,createdAt:initial?.createdAt||new Date().toISOString()
      });
      onClose();
    }catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setBusy(false);}
  }
  return <div className="dialog-backdrop memrly-memory-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={initial?'Editar recuerdo':'Crear recuerdo'} className="memrly-memory-editor">
      <header className="memrly-memory-header">
        <h2>{initial?'Editar recuerdo':'Crear recuerdo'}</h2>
        <button type="button" aria-label="Cerrar" onClick={onClose} disabled={busy}><X size={21}/></button>
      </header>
      <form onSubmit={submit} className="memrly-memory-form">
        <div className="memrly-memory-main">
          <div className="memrly-memory-top">
            <button type="button" className="memrly-memory-cover" onClick={()=>setChooseCover(true)} aria-label="Elegir fotografía de portada">
              {coverId?<PhotoView id={coverId} className="memrly-memory-cover-photo"/>:
                <span><Camera size={30}/><strong>Elegir portada</strong><small>Fotografía del recuerdo</small></span>}
            </button>
            <div className="memrly-memory-details">
              <div className="memrly-memory-kind" role="group" aria-label="Tipo de recuerdo">
                {([{id:'moment',label:'Momento',icon:Heart},{id:'event',label:'Evento',icon:CalendarDays},{id:'trip',label:'Viaje',icon:Plane}] as const).map(({id,label,icon:Icon})=>
                  <button key={id} type="button" className={kind===id?'active':''} aria-pressed={kind===id} onClick={()=>setKind(id)}><Icon size={17}/>{label}</button>)}
              </div>
              <label className="memrly-memory-input"><span>Nombre</span>
                <input value={title} required maxLength={110} onChange={e=>setTitle(e.target.value)}
                  placeholder={kind==='trip'?'Nuestro viaje a…':kind==='event'?'Nombre del evento':'Un momento para recordar'}/>
              </label>
              <label className="memrly-memory-input"><span>Descripción</span>
                <textarea value={description} rows={3} onChange={e=>setDescription(e.target.value)} placeholder="¿Qué quieres recordar?"/>
              </label>
            </div>
          </div>
          <div className="memrly-memory-divider"/>
          <section className="memrly-memory-fields">
            <div className="memrly-memory-row">
              <div className="memrly-memory-row-title"><CalendarDays size={20}/><div><strong>Fecha</strong>
                <small>{kind==='moment'?'Cuándo ocurrió':kind==='trip'?'Inicio y final del viaje':'Inicio y final del evento'}</small></div></div>
              <div className="memrly-memory-dates">
                <label><span>{kind==='moment'?'Día':'Inicio'}</span><input type="date" required value={startDate} onChange={e=>{
                  setStartDate(e.target.value);if(endDate<e.target.value)setEndDate(e.target.value);
                }}/></label>
                {kind!=='moment'&&<label><span>Final</span><input type="date" required min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>}
              </div>
            </div>
            <div className="memrly-memory-row">
              <div className="memrly-memory-row-title"><MapPin size={20}/><div><strong>Lugar</strong><small>Dónde ocurrió</small></div></div>
              <div className="memrly-online-place-search">
                <LocationSearch value={place} onSelect={choice=>{setPlace(choice.label);setLatitude(choice.latitude);setLongitude(choice.longitude);}}/>
                {place&&latitude!==undefined&&longitude!==undefined&&<small className="memrly-place-selection">
                  <MapPin size={13}/> {place} · {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </small>}
              </div>
            </div>
            <div className="memrly-memory-row">
              <div className="memrly-memory-row-title"><Link2 size={20}/><div><strong>Asociar a…</strong><small>Otros viajes, eventos o recuerdos</small></div></div>
              <div className="memrly-memory-relations">
                {selectedRelated.length>0&&<div className="memrly-memory-related-selected">{selectedRelated.map(m=>
                  <button type="button" key={m.id} onClick={()=>selectRelated(m.id)}>{m.title} <X size={13}/></button>)}</div>}
                {candidates.filter(m=>!related.includes(m.id)).length>0
                  ? <div className="memrly-memory-related-options">{candidates.filter(m=>!related.includes(m.id)).map(m=>
                      <button type="button" key={m.id} onClick={()=>selectRelated(m.id)}>+ {m.title} · {dateLabel(m.startDate,'short')}</button>)}</div>
                  : <small>No hay más recuerdos que coincidan con estas fechas.</small>}
              </div>
            </div>
          </section>
          {error&&<p className="form-errors" role="alert">{error}</p>}
        </div>
        <footer className="memrly-memory-footer">
          <button type="button" className="memrly-memory-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="memrly-memory-save" disabled={busy||!title.trim()}>{busy?'Guardando…':'Guardar'}</button>
        </footer>
      </form>
      {chooseCover&&<div className="memrly-memory-picker-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setChooseCover(false);}}>
        <section className="memrly-memory-picker" role="dialog" aria-label="Elegir portada">
          <header><h3>Elegir fotografía de portada</h3><button type="button" aria-label="Cerrar selector" onClick={()=>setChooseCover(false)}><X size={19}/></button></header>
          <button type="button" className="memrly-memory-clear-cover" onClick={()=>{setCoverId('');setChooseCover(false);}}>Sin fotografía de portada</button>
          <div className="memrly-memory-picker-grid">
            {photos.map(p=><button key={p.id} type="button" className={coverId===p.id?'selected':''} title={p.filename} onClick={()=>{setCoverId(p.id);setChooseCover(false);}}>
              <PhotoView id={p.id} className="memrly-memory-picker-photo"/></button>)}
          </div>
          {!photos.length&&<p>No hay fotografías importadas todavía. Puedes añadir una portada más adelante.</p>}
        </section>
      </div>}
    </section>
  </div>;
}
