import { useEffect, useRef, useState } from 'react';
import { Camera, Check, MoreHorizontal, X } from 'lucide-react';
import type { Photo } from '../types';
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

export function CoverPicker({photos,selectedId,onClose,onSelect,title}:{
  photos:Photo[];selectedId?:string;title:string;onClose:()=>void;onSelect:(id?:string)=>Promise<void>;
}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const items=[...photos].sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt));
  async function select(id?:string){
    if(busy)return;
    setBusy(true);setError('');
    try{await onSelect(id);onClose();}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
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
        <p className="helper-text">Selecciona una fotografía ya importada. No se duplica el archivo ni se modifica el original.</p>
        {items.length===0?<p className="muted-text">Aún no hay fotografías en el álbum. Importa alguna para poder elegirla como portada.</p>:<div className="cover-picker-grid">
          {items.map(p=><button type="button" disabled={busy} key={p.id} className={'cover-choice '+(p.id===selectedId?'chosen':'')} onClick={()=>select(p.id)}>
            <PhotoView id={p.id} quality="thumb" className="cover-choice-image"/>
            {p.id===selectedId&&<span className="cover-choice-check"><Check size={18}/></span>}
            <span className="cover-choice-caption">{dateLabel(p.takenOn,'short')}</span>
          </button>)}
        </div>}
        {error&&<p role="alert" className="form-errors">{error}</p>}
        <div className="form-actions"><button type="button" disabled={busy} className="btn subtle" onClick={()=>select(undefined)}>Usar fondo automático</button><button type="button" className="btn subtle" onClick={onClose}>Cancelar</button></div>
      </div>
    </section>
  </div>;
}
