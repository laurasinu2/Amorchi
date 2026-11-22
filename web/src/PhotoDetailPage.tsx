import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Edit3, Expand, Heart, Image as ImageIcon, MapPin, Maximize2, Minus, MoreHorizontal, Plus, PlusCircle, RotateCcw, Share2, Trash2, Users, X, ZoomIn } from 'lucide-react';
import type { AppSettings, Memory, Photo, Subject } from './types';
import { dateLabel, kindName } from './dates';
import { getPhotoAsset } from './db';
import { PhotoView } from './components/PhotoView';

type Move={x:number;y:number};
function usePhotoBlob(id:string,quality:'preview'|'original'){
  const [url,setUrl]=useState('');
  const [missing,setMissing]=useState(false);
  useEffect(()=>{
    let active=true,objectUrl='';
    setUrl('');setMissing(false);
    getPhotoAsset(id,quality).then(blob=>{
      if(!active)return;
      if(!blob){setMissing(true);return;}
      objectUrl=URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(()=>{if(active)setMissing(true);});
    return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[id,quality]);
  return {url,missing};
}

function ZoomImage({id,zoom,move,setMove,fullscreen=false}:{
  id:string;zoom:number;move:Move;setMove:(next:Move)=>void;fullscreen?:boolean;
}){
  const {url,missing}=usePhotoBlob(id,fullscreen?'original':'preview');
  const drag=useRef<{x:number;y:number;origin:Move}|null>(null);
  const start=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(zoom<=1)return;
    drag.current={x:event.clientX,y:event.clientY,origin:move};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const update=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    setMove({x:drag.current.origin.x+event.clientX-drag.current.x,y:drag.current.origin.y+event.clientY-drag.current.y});
  };
  const stop=()=>{drag.current=null;};
  return <div className={'memrly-zoom-stage'+(fullscreen?' is-fullscreen':'')+(zoom>1?' can-drag':'')}
    onPointerDown={start} onPointerMove={update} onPointerUp={stop} onPointerCancel={stop}
    aria-label={zoom>1?'Fotografía ampliada: arrastra para encuadrar':'Fotografía'}>
    {url?<img src={url} alt="Fotografía seleccionada" draggable={false}
      style={{transform:'translate('+move.x+'px,'+move.y+'px) scale('+zoom+')'}}/>:
      <div className="memrly-zoom-placeholder">{missing?'No se ha encontrado el archivo original.':'Cargando fotografía…'}</div>}
  </div>;
}

function ZoomControls({zoom,setZoom,reset}:{
  zoom:number;setZoom:(value:number)=>void;reset:()=>void;
}){
  const clamp=(n:number)=>Math.min(5,Math.max(1,Math.round(n*10)/10));
  return <div className="memrly-zoom-controls">
    <span className="memrly-control-label">Zoom y encuadre</span>
    <button type="button" title="Reducir zoom" aria-label="Reducir zoom" onClick={()=>setZoom(clamp(zoom-.25))} disabled={zoom<=1}><Minus size={17}/></button>
    <input type="range" min="1" max="5" step=".1" aria-label="Zoom de la fotografía" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
    <button type="button" title="Aumentar zoom" aria-label="Aumentar zoom" onClick={()=>setZoom(clamp(zoom+.25))} disabled={zoom>=5}><Plus size={17}/></button>
    <output>{Math.round(zoom*100)}%</output>
    <button type="button" onClick={reset} title="Restablecer encuadre" aria-label="Restablecer encuadre"><RotateCcw size={17}/></button>
    <span className="memrly-zoom-instruction">Arrastra la foto cuando esté ampliada</span>
  </div>;
}

function Avatar({subject,settings}:{
  subject:Subject;settings:AppSettings;
}){
  const photoId=subject.avatarPhotoId||(settings.profileSubjectId===subject.id?settings.profilePhotoId:undefined);
  return <div className="memrly-person-avatar" title={subject.name}>
    {photoId?<PhotoView id={photoId} className="memrly-person-avatar-photo"/>:
      subject.kind==='animal'?<span aria-hidden="true">🐾</span>:<Users size={18}/>}
  </div>;
}

const ordered=(photos:Photo[])=>[...photos].sort((a,b)=>a.takenOn.localeCompare(b.takenOn)||
  (a.takenTime||'').localeCompare(b.takenTime||'')||a.createdAt.localeCompare(b.createdAt));

export function PhotoDetailPage({photo,photos,memories,subjects,settings,onBack,onSelect,onSave,onEdit,onOpenMemory,onOpenDay,onCreateSubject,onDelete}:{
  photo:Photo;photos:Photo[];memories:Memory[];subjects:Subject[];settings:AppSettings;
  onBack:()=>void;onSelect:(id:string)=>void;onSave:(photo:Photo)=>Promise<void>;onEdit:()=>void;
  onOpenMemory:(id:string)=>void;onOpenDay:(date:string)=>void;onCreateSubject:()=>void;
  onDelete:(id:string)=>Promise<void>;
}){
  const [zoom,setZoom]=useState(1);
  const [move,setMove]=useState<Move>({x:0,y:0});
  const [fullscreen,setFullscreen]=useState(false);
  const [more,setMore]=useState(false);
  const [peoplePicker,setPeoplePicker]=useState(false);
  const [allRelations,setAllRelations]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const moreRef=useRef<HTMLDivElement>(null);
  const peopleRef=useRef<HTMLDivElement>(null);
  const filmstripRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    setZoom(1);setMove({x:0,y:0});setAllRelations(false);setMore(false);setPeoplePicker(false);setNotice('');
  },[photo.id]);
  useEffect(()=>{
    if(!fullscreen)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setFullscreen(false);};
    document.addEventListener('keydown',escape);
    return ()=>document.removeEventListener('keydown',escape);
  },[fullscreen]);
  useEffect(()=>{
    if(!more&&!peoplePicker)return;
    const outside=(e:PointerEvent)=>{
      if(more&&!moreRef.current?.contains(e.target as Node))setMore(false);
      if(peoplePicker&&!peopleRef.current?.contains(e.target as Node))setPeoplePicker(false);
    };
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[more,peoplePicker]);

  const group=useMemo(()=>{
    const ids=new Set(photo.memoryIds);
    const matching=photos.filter(p=>p.id===photo.id||p.takenOn===photo.takenOn||p.memoryIds.some(id=>ids.has(id)));
    return ordered(matching);
  },[photo,photos]);
  const currentIndex=Math.max(0,group.findIndex(p=>p.id===photo.id));
  const stripStart=Math.max(0,Math.min(currentIndex-4,Math.max(0,group.length-9)));
  const strip=group.slice(stripStart,stripStart+9);
  const linkedMemories=useMemo(()=>memories
    .filter(m=>photo.memoryIds.includes(m.id)||(m.startDate<=photo.takenOn&&m.endDate>=photo.takenOn))
    .sort((a,b)=>Number(photo.memoryIds.includes(b.id))-Number(photo.memoryIds.includes(a.id))||a.title.localeCompare(b.title,'es')),[memories,photo]);
  const selectedSubjects=subjects.filter(s=>photo.subjectIds.includes(s.id));
  const place=photo.place.trim()||(photo.latitude!==undefined&&photo.longitude!==undefined?photo.latitude.toFixed(5)+', '+photo.longitude.toFixed(5):'Sin ubicación');
  function reset(){setZoom(1);setMove({x:0,y:0});}
  function changeZoom(value:number){setZoom(value);if(value<=1)setMove({x:0,y:0});}
  function browse(delta:number){const other=group[currentIndex+delta];if(other)onSelect(other.id);}
  async function toggleFavorite(){
    if(busy)return;setBusy(true);setNotice('');
    try{await onSave({...photo,favorite:!photo.favorite});}
    catch(e){setNotice('No se pudo actualizar el favorito: '+String(e));}
    finally{setBusy(false);}
  }
  async function toggleSubject(id:string){
    if(busy)return;setBusy(true);setNotice('');
    try{await onSave({...photo,subjectIds:photo.subjectIds.includes(id)?photo.subjectIds.filter(v=>v!==id):[...photo.subjectIds,id]});}
    catch(e){setNotice('No se pudieron guardar las personas: '+String(e));}
    finally{setBusy(false);}
  }
  async function originalFile(){
    const blob=await getPhotoAsset(photo.id,'original');
    if(!blob)throw new Error('No se encontró el archivo original.');
    return new File([blob],photo.filename,{type:photo.mimeType||blob.type||'application/octet-stream'});
  }
  async function downloadFile(file?:File){
    const original=file||await originalFile();
    const url=URL.createObjectURL(original);
    const link=document.createElement('a');link.href=url;link.download=original.name;document.body.appendChild(link);
    link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function share(){
    if(busy)return;setBusy(true);setNotice('');
    try{
      const file=await originalFile();
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({files:[file],title:'Fotografía de Memrly'});
      }else{
        await downloadFile(file);
        setNotice('Tu navegador no permite compartir archivos directamente. Se ha descargado el original para que puedas enviarlo.');
      }
    }catch(e){
      if(e instanceof Error&&e.name==='AbortError')return;
      setNotice('No se ha podido compartir: '+String(e));
    }finally{setBusy(false);}
  }
  async function download(){
    setMore(false);setNotice('');
    try{await downloadFile();}
    catch(e){setNotice('No se pudo descargar: '+String(e));}
  }
  async function remove(){
    if(busy)return;setBusy(true);
    try{await onDelete(photo.id);setConfirmDelete(false);}
    catch(e){setNotice('No se pudo eliminar: '+String(e));setBusy(false);}
  }

  return <div className="memrly-photo-detail">
    <header className="memrly-photo-header">
      <div className="memrly-photo-heading">
        <button type="button" className="memrly-photo-icon-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={21}/></button>
        <h1>Fotografía</h1>
      </div>
      <div className="memrly-photo-toolbar">
        <button type="button" className={'memrly-photo-icon-btn'+(photo.favorite?' active':'')} disabled={busy} aria-label={photo.favorite?'Quitar de favoritos':'Añadir a favoritos'} title="Favoritos" onClick={toggleFavorite}>
          <Heart size={20} fill={photo.favorite?'currentColor':'none'}/></button>
        <button type="button" className="memrly-photo-icon-btn" disabled={busy} title="Compartir fotografía" aria-label="Compartir fotografía" onClick={share}><Share2 size={19}/></button>
        <button type="button" className="memrly-photo-icon-btn" title="Editar fotografía" aria-label="Editar fotografía" onClick={onEdit}><Edit3 size={19}/></button>
        <div className="memrly-photo-menu-wrap" ref={moreRef}>
          <button type="button" className="memrly-photo-icon-btn" title="Más opciones" aria-label="Más opciones" aria-expanded={more} onClick={()=>setMore(v=>!v)}><MoreHorizontal size={21}/></button>
          {more&&<div className="memrly-photo-popup" role="menu">
            <button type="button" role="menuitem" onClick={download}><Download size={17}/> Descargar original</button>
            <button type="button" role="menuitem" onClick={()=>{setMore(false);onOpenDay(photo.takenOn);}}><CalendarDays size={17}/> Abrir día en calendario</button>
            <button type="button" role="menuitem" onClick={()=>{setMore(false);setConfirmDelete(true);}}><Trash2 size={17}/> Eliminar fotografía</button>
          </div>}
        </div>
      </div>
    </header>

    {notice&&<div className="memrly-photo-notice" role="status">{notice}<button type="button" aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
    <div className="memrly-photo-columns">
      <section className="memrly-photo-visual" aria-label="Fotografía y navegación">
        <div className="memrly-photo-frame">
          <ZoomImage id={photo.id} zoom={zoom} move={move} setMove={setMove}/>
          <button type="button" className="memrly-photo-expand" aria-label="Ampliar fotografía" title="Pantalla completa" onClick={()=>setFullscreen(true)}><Maximize2 size={19}/></button>
        </div>
        <ZoomControls zoom={zoom} setZoom={changeZoom} reset={reset}/>
        <div className="memrly-photo-strip" aria-label="Fotografías del mismo viaje o día">
          <div className="memrly-photo-strip-title"><strong>Fotos relacionadas</strong><small>{group.length} fotografías · mismo día o viaje</small></div>
          <div className="memrly-photo-strip-track">
            <button type="button" aria-label="Fotografía anterior" className="memrly-photo-strip-arrow" onClick={()=>browse(-1)} disabled={currentIndex===0}><ChevronLeft/></button>
            <div className="memrly-photo-strip-items" ref={filmstripRef}>
              {strip.map(p=><PhotoView id={p.id} key={p.id} className={'memrly-photo-strip-thumb'+(p.id===photo.id?' selected':'')} onClick={()=>onSelect(p.id)}/>)}
            </div>
            <button type="button" aria-label="Siguiente fotografía" className="memrly-photo-strip-arrow" onClick={()=>browse(1)} disabled={currentIndex>=group.length-1}><ChevronRight/></button>
          </div>
        </div>
      </section>

      <aside className="memrly-photo-sidebar" aria-label="Información de la fotografía">
        <section className="memrly-photo-panel memrly-photo-information">
          <h2>Detalles de la fotografía</h2>
          <div className="memrly-photo-detail-rows">
            <div className="memrly-photo-detail-row"><CalendarDays size={19}/><div><strong>Fecha</strong><span>{dateLabel(photo.takenOn)}{photo.takenTime?', '+photo.takenTime:''}</span></div></div>
            <div className="memrly-photo-detail-row"><MapPin size={19}/><div><strong>Lugar</strong><span>{place}</span></div></div>
            <div className="memrly-photo-detail-row"><ImageIcon size={19}/><div><strong>Viaje / recuerdo / evento</strong>
              {linkedMemories.some(m=>photo.memoryIds.includes(m.id))?<span>{linkedMemories.filter(m=>photo.memoryIds.includes(m.id)).map(m=>m.title).join(' · ')}</span>:<span>Sin asociación directa</span>}
            </div></div>
            <div className="memrly-photo-detail-row memrly-people-row"><Users size={19}/><div><strong>Personas y mascotas</strong>
              <div className="memrly-people-list">
                {selectedSubjects.length?selectedSubjects.map(s=><span className="memrly-person-item" key={s.id}><Avatar subject={s} settings={settings}/><small>{s.name}</small></span>):<span className="memrly-empty-small">Sin personas asociadas</span>}
                <div className="memrly-person-add-wrap" ref={peopleRef}>
                  <button type="button" className="memrly-person-add" aria-label="Añadir persona o mascota" title="Añadir persona o mascota" onClick={()=>setPeoplePicker(v=>!v)}><Plus size={20}/></button>
                  {peoplePicker&&<div className="memrly-photo-popup memrly-people-popup">
                    <strong>Asociar personas o mascotas</strong>
                    {subjects.map(s=><button type="button" key={s.id} disabled={busy} onClick={()=>toggleSubject(s.id)}>
                      {photo.subjectIds.includes(s.id)?<Check size={16}/>:<PlusCircle size={16}/>} {s.name}</button>)}
                    <button type="button" onClick={()=>{setPeoplePicker(false);onCreateSubject();}}><Plus size={16}/> Crear persona o mascota</button>
                  </div>}
                </div>
              </div>
            </div></div>
          </div>
        </section>

        <section className="memrly-photo-panel memrly-photo-relations">
          <h2>Recuerdos relacionados</h2>
          <div className="memrly-photo-relation-list">
            {linkedMemories.length?linkedMemories.slice(0,allRelations?undefined:3).map(m=><button type="button" className="memrly-relation-item" key={m.id} onClick={()=>onOpenMemory(m.id)}>
              <div className="memrly-relation-cover">{(m.coverPhotoId||photos.find(p=>p.memoryIds.includes(m.id))?.id)?<PhotoView id={(m.coverPhotoId||photos.find(p=>p.memoryIds.includes(m.id))?.id)!} className="memrly-relation-image"/>:<Heart size={20}/>}</div>
              <span><small>{kindName(m.kind)} · {dateLabel(m.startDate,'short')}</small><strong>{m.title}</strong></span><ChevronRight size={17}/>
            </button>):<p className="memrly-empty-small">No hay viajes, eventos ni recuerdos que coincidan con esta fecha.</p>}
          </div>
          {linkedMemories.length>3&&<button type="button" className="memrly-all-relations" onClick={()=>setAllRelations(v=>!v)}>
            {allRelations?'Mostrar solo tres':'Ver todas las relaciones ('+linkedMemories.length+')'} <ChevronRight size={16}/>
          </button>}
        </section>
      </aside>
    </div>

    {fullscreen&&<div className="memrly-photo-lightbox" role="dialog" aria-modal="true" aria-label="Fotografía ampliada">
      <div className="memrly-photo-lightbox-top"><span>{photo.filename}</span>
        <button type="button" className="memrly-lightbox-close" onClick={()=>setFullscreen(false)} aria-label="Volver a la ficha"><X size={23}/> Volver</button></div>
      <div className="memrly-photo-lightbox-image"><ZoomImage id={photo.id} zoom={zoom} move={move} setMove={setMove} fullscreen/></div>
      <ZoomControls zoom={zoom} setZoom={changeZoom} reset={reset}/>
    </div>}

    {confirmDelete&&<div className="memrly-photo-confirm-backdrop" role="presentation">
      <div className="memrly-photo-confirm" role="alertdialog" aria-modal="true" aria-label="Eliminar fotografía">
        <h2>¿Eliminar esta fotografía?</h2><p>Se eliminará el original y todas sus variantes locales. Esta acción no se puede deshacer.</p>
        <div className="memrly-photo-confirm-actions"><button type="button" disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancelar</button><button type="button" disabled={busy} onClick={remove}>{busy?'Eliminando…':'Sí, eliminar fotografía'}</button></div>
      </div>
    </div>}
  </div>;
}
