import { useEffect, useRef, useState } from 'react';
import { Camera, Check, MoreHorizontal, X, Move } from 'lucide-react';
import type { CoverPosition, Photo } from '../types';
import { dateLabel } from '../dates';
import { PhotoView } from './PhotoView';

export function CoverMenu({onChange}:{onChange:()=>void}){
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    function closeOnOutside(e:PointerEvent){
      if(!ref.current?.contains(e.target as Node))setOpen(false);
    }
    function escape(e:KeyboardEvent){if(e.key==='Escape')setOpen(false);}
    document.addEventListener('pointerdown',closeOnOutside);
    document.addEventListener('keydown',escape);
    return ()=>{
      document.removeEventListener('pointerdown',closeOnOutside);
      document.removeEventListener('keydown',escape);
    };
  },[open]);
  return <div className="cover-actions" ref={ref}>
    <button type="button" className="cover-dots" aria-label="Opciones de la foto de fondo" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)}><MoreHorizontal size={23}/></button>
    {open&&<div role="menu" className="cover-dropdown">
      <button role="menuitem" type="button" onClick={()=>{setOpen(false);onChange();}}><Camera size={16}/> Cambiar foto de fondo</button>
    </div>}
  </div>;
}

const centered:CoverPosition={x:50,y:50};
export function CoverPicker({photos,selectedId,selectedPosition,previewKind='memory',onClose,onSelect,title}:{
  photos:Photo[];selectedId?:string;selectedPosition?:CoverPosition;previewKind?:'home'|'year'|'memory';title:string;
  onClose:()=>void;onSelect:(id?:string,position?:CoverPosition)=>Promise<void>;
}){
  const [chosen,setChosen]=useState(selectedId||'');
  const [point,setPoint]=useState<CoverPosition>(selectedPosition||centered);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const items=[...photos].sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt));
  function pick(id:string){
    setChosen(id);
    setPoint(id===selectedId?selectedPosition||centered:centered);
  }
  async function save(id?:string,position?:CoverPosition){
    if(busy)return;
    setBusy(true);setError('');
    try{await onSelect(id,position);onClose();}
    catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);}
  }
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[onClose,busy]);
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={title} className="dialog wide cover-picker">
      <header className="dialog-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar" disabled={busy}><X/></button></header>
      <div className="dialog-body">
        <p className="helper-text">Elige una foto y ajusta qué parte se ve en la portada. El original no se modifica ni se duplica.</p>
        {chosen&&<div className="cover-framing">
          <div className={'cover-frame-preview preview-'+previewKind}><PhotoView id={chosen} quality="preview" focalPoint={point} className="cover-frame-photo"/></div>
          <div className="cover-frame-controls"><strong><Move size={17}/> Ajustar encuadre</strong>
            <label>Horizontal <input type="range" min="0" max="100" step="1" value={point.x} onChange={e=>setPoint(p=>({...p,x:Number(e.target.value)}))}/></label>
            <label>Vertical <input type="range" min="0" max="100" step="1" value={point.y} onChange={e=>setPoint(p=>({...p,y:Number(e.target.value)}))}/></label>
            <button type="button" className="btn subtle" onClick={()=>setPoint(centered)}>Centrar foto</button>
          </div>
        </div>}
        {items.length===0?<p className="muted-text">Importa una fotografía antes de elegirla como portada.</p>:<div className="cover-picker-grid">
          {items.map(p=><button type="button" disabled={busy} key={p.id} className={'cover-choice '+(p.id===chosen?'chosen':'')} onClick={()=>pick(p.id)}>
            <PhotoView id={p.id} quality="thumb" className="cover-choice-image"/>
            {p.id===chosen&&<span className="cover-choice-check"><Check size={18}/></span>}
            <span className="cover-choice-caption">{dateLabel(p.takenOn,'short')}</span>
          </button>)}
        </div>}
        {error&&<p role="alert" className="form-errors">{error}</p>}
        <div className="form-actions">
          <button type="button" disabled={busy} className="btn subtle" onClick={()=>save(undefined)}>Fondo automático</button>
          <button type="button" className="btn subtle" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="btn primary" onClick={()=>save(chosen,point)} disabled={busy||!chosen}>{busy?'Guardando…':'Guardar portada'}</button>
        </div>
      </div>
    </section>
  </div>;
}
