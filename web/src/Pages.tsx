import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, CloudUpload, HardDrive, Heart, MapPin, PawPrint, Plus, Search, ShieldCheck, Star, Trash2, Users } from 'lucide-react';
import type { AppSettings, Memory, Photo, Subject } from './types';
import { dateLabel, kindName } from './dates';
import { getLocalUsage, requestPersistence } from './db';
import { CalendarGrid } from './components/CalendarGrid';
import { PhotoView } from './components/PhotoView';
import { WorldMap } from './components/WorldMap';
import { CoverMenu } from './components/CoverPicker';
import { SpecialDatesSettings } from './components/SpecialDatesSettings';
export { Dashboard, YearsPage } from './OverviewPages';
export { CalendarPage } from './CalendarRedesign';
export type { CalendarMode } from './CalendarRedesign';

export function SectionTitle({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}){
  return <div className="section-title"><h2>{title}</h2>{action&&<button className="text-link" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>;
}
export function EmptyState({title,description,onAction,action}:{title:string;description:string;onAction?:()=>void;action?:string}){
  return <div className="empty-state"><div className="empty-icon"><Camera size={32}/></div><h3>{title}</h3><p>{description}</p>{onAction&&<button className="btn primary" onClick={onAction}><Plus size={17}/>{action||'Añadir'}</button>}</div>;
}
export function PhotoGrid({photos,onView,limit}:{photos:Photo[];onView:(id:string)=>void;limit?:number}){
  const shown=limit?photos.slice(0,limit):photos;
  if(!shown.length)return <p className="muted-text">No hay fotografías en esta selección.</p>;
  return <div className="photo-gallery">{shown.map(p=><PhotoView key={p.id} id={p.id} onClick={()=>onView(p.id)} className="gallery-photo">
    <span className="photo-overlay"><span>{p.takenTime||dateLabel(p.takenOn,'short')}</span>{p.favorite&&<Heart size={16} fill="currentColor"/>}</span>
  </PhotoView>)}</div>;
}
const orderPhotos=(photos:Photo[])=>[...photos].sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt));
const coverOf=(m:Memory,photos:Photo[])=>m.coverPhotoId||photos.find(p=>p.memoryIds.includes(m.id))?.id;
function MemoryCard({memory,photos,onOpen}:{memory:Memory;photos:Photo[];onOpen:(id:string)=>void}){
  const cover=coverOf(memory,photos);
  return <button className="memory-card" onClick={()=>onOpen(memory.id)}>
    {cover?<PhotoView id={cover} focalPoint={memory.coverPhotoId===cover?memory.coverPosition:undefined} className="memory-cover"/>:<span className={'memory-cover placeholder '+memory.kind}>{memory.kind==='trip'?'✈':memory.kind==='event'?'✦':'♡'}</span>}
    <span className="memory-card-content"><span className="pill kind">{kindName(memory.kind)}</span><strong>{memory.title}</strong><small><CalendarDays size={13}/>{dateLabel(memory.startDate,'short')}{memory.endDate!==memory.startDate?' · '+dateLabel(memory.endDate,'short'):''}</small>{memory.place&&<small><MapPin size={13}/>{memory.place}</small>}</span>
  </button>;
}

export function MemoriesPage({memories,photos,onlyTrips,onOpen,onCreate}:{
  memories:Memory[];photos:Photo[];onlyTrips:boolean;onOpen:(id:string)=>void;onCreate:()=>void;
}){
  const selected=[...memories].filter(m=>onlyTrips?m.kind==='trip':m.kind!=='trip').sort((a,b)=>b.startDate.localeCompare(a.startDate));
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">NUESTRA HISTORIA</span><div className="intro-actions"><h1>{onlyTrips?'Viajes y escapadas':'Momentos y eventos'}</h1><button className="btn primary" onClick={onCreate}><Plus size={17}/> Crear</button></div><p>{onlyTrips?'Descubre los lugares que habéis recorrido juntos.':'Cada experiencia merece un lugar en vuestro álbum.'}</p></div>
    {selected.length?<div className="memory-cards">{selected.map(m=><MemoryCard key={m.id} memory={m} photos={photos} onOpen={onOpen}/>)}</div>:<EmptyState title="Aún no hay recuerdos" description="Crea el primero y relaciónalo con las fotografías que importes." onAction={onCreate} action="Crear recuerdo"/>}
  </div>;
}

export function MemoryDetail({memory,memories,photos,subjects,settings,onViewPhoto,onEdit,onOpenMemory,onChangeCover,onDelete}:{
  memory:Memory;memories:Memory[];photos:Photo[];subjects:Subject[];settings:AppSettings;
  onViewPhoto:(id:string)=>void;onEdit:()=>void;onOpenMemory:(id:string)=>void;onChangeCover:()=>void;onDelete:()=>void;
}){
  const [tab,setTab]=useState<'summary'|'photos'|'map'>('summary');
  useEffect(()=>setTab('summary'),[memory.id]);
  const related=orderPhotos(photos.filter(p=>p.memoryIds.includes(memory.id)));
  const cover=coverOf(memory,photos);
  const people=subjects.filter(s=>related.some(p=>p.subjectIds.includes(s.id)));
  const relatedMemories=memories.filter(m=>m.id!==memory.id&&(m.startDate>=memory.startDate&&m.startDate<=memory.endDate));
  const [y,m]=memory.startDate.split('-').map(Number);
  return <div className="page-stack memory-detail">
    <section className="memory-hero">{cover&&<PhotoView id={cover} quality="preview" focalPoint={memory.coverPhotoId===cover?memory.coverPosition:undefined} className="memory-hero-image"/>}
      <div className="memory-hero-content"><span className="pill hero-pill">{kindName(memory.kind)}</span><h1>{memory.kind==='trip'?'✈ ':''}{memory.title}</h1><p><CalendarDays size={17}/>{dateLabel(memory.startDate,'short')}{memory.endDate!==memory.startDate?' – '+dateLabel(memory.endDate,'short'):''}{memory.place&&<> · <MapPin size={17}/>{memory.place}</>}</p></div>
      <button className="btn light hero-edit" onClick={onEdit}>Editar recuerdo</button><CoverMenu onChange={onChangeCover}/>
    </section>
    <div className="memory-content"><div className="memory-main">
      <div className="detail-tabs"><button className={tab==='summary'?'active':''} onClick={()=>setTab('summary')}>Resumen</button><button className={tab==='photos'?'active':''} onClick={()=>setTab('photos')}>Fotos ({related.length})</button><button className={tab==='map'?'active':''} onClick={()=>setTab('map')}>Mapa</button></div>
      {tab==='summary'&&<>
        {related.length?<div className="mosaic">{related.slice(0,5).map((p,i)=><PhotoView key={p.id} id={p.id} className={'mosaic-photo mosaic-'+i} onClick={()=>onViewPhoto(p.id)}/>)}</div>:<EmptyState title="Sin fotos asociadas" description="Abre una foto del álbum y vincúlala con este recuerdo."/>}
        <section className="panel"><SectionTitle title="Calendario del recuerdo"/><CalendarGrid year={y} month={m-1} photos={related} memories={[memory]} settings={settings} onDay={()=>setTab('photos')}/></section>
        {memory.description&&<section className="panel"><SectionTitle title="Nuestra historia"/><p>{memory.description}</p></section>}
        <section className="panel"><SectionTitle title="Momentos destacados"/><PhotoGrid photos={related.slice(0,8)} onView={onViewPhoto}/></section>
      </>}
      {tab==='photos'&&<section className="panel"><SectionTitle title={`Fotografías de ${memory.title}`}/><PhotoGrid photos={related} onView={onViewPhoto}/></section>}
      {tab==='map'&&<WorldMap memories={[memory]} onSelect={()=>setTab('summary')}/>}
    </div><aside className="detail-aside">
      <section className="panel"><h3>Información del recuerdo</h3><p><CalendarDays size={17}/>{dateLabel(memory.startDate,'short')}</p><p><MapPin size={17}/>{memory.place||'Lugar sin definir'}</p><p><Camera size={17}/>{related.length} fotografías</p></section>
      <section className="panel"><h3>Personas y mascotas ({people.length})</h3>{people.length?<div className="chips">{people.map(s=><span className="chip" key={s.id}>{s.kind==='animal'?'🐾':'♡'} {s.name}</span>)}</div>:<p className="muted-text">Sin etiquetas aún.</p>}</section>
      <section className="panel"><h3>Recuerdos relacionados</h3>{relatedMemories.length?relatedMemories.map(r=><button className="related-link" key={r.id} onClick={()=>onOpenMemory(r.id)}>{r.title}<ArrowRight size={16}/></button>):<p className="muted-text">Ninguno en estas fechas.</p>}</section>
      <section className="panel memory-actions-panel">
        <h3>Gestionar {kindName(memory.kind).toLowerCase()}</h3>
        <button type="button" className="btn danger-outline" onClick={onDelete}><Trash2 size={16}/> Eliminar {kindName(memory.kind).toLowerCase()}</button>
        <small>Las fotografías se conservarán en el álbum.</small>
      </section>
    </aside></div>
  </div>;
}

export function AlbumPage({photos,onView,filterFavorites=false}:{photos:Photo[];onView:(id:string)=>void;filterFavorites?:boolean}){
  const shown=orderPhotos(photos.filter(p=>!filterFavorites||p.favorite));
  const groups=new Map<string,Photo[]>();
  for(const photo of shown){const arr=groups.get(photo.takenOn)||[];arr.push(photo);groups.set(photo.takenOn,arr);}
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">BIBLIOTECA FOTOGRÁFICA</span><h1>{filterFavorites?'Fotografías favoritas':'Todas nuestras fotografías'}</h1><p>{shown.length} fotografías · agrupadas por día</p></div>
    {shown.length?[...groups.entries()].map(([date,list])=><section className="panel photo-day-section" key={date}><SectionTitle title={dateLabel(date)}/><PhotoGrid photos={list} onView={onView}/></section>):<EmptyState title={filterFavorites?'Sin favoritas todavía':'No hay fotografías aún'} description="Importa fotografías o marca alguna como favorita para verla aquí."/>}
  </div>;
}

export function PlacesPage({memories,onOpen}:{memories:Memory[];onOpen:(id:string)=>void}){
  const pinned=memories.filter(m=>m.latitude!==undefined&&m.longitude!==undefined);
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">NUESTRO MUNDO</span><h1>Mapa de recuerdos</h1><p>Un marcador por viaje, evento o momento, nunca una chincheta por fotografía.</p></div>
    <WorldMap memories={pinned} onSelect={onOpen}/>
    <SectionTitle title={`Recuerdos localizados (${pinned.length})`}/>
    {pinned.length?<div className="location-list">{pinned.map(m=><button key={m.id} onClick={()=>onOpen(m.id)}><MapPin size={18}/><span><strong>{m.title}</strong><small>{m.place||kindName(m.kind)}</small></span><ArrowRight size={15}/></button>)}</div>:<EmptyState title="El mapa está esperando recuerdos" description="Edita un viaje o momento y añade sus coordenadas para localizarlo en el mapa."/>}
  </div>;
}

export function PeoplePage({subjects,photos,onCreate,onView}:{subjects:Subject[];photos:Photo[];onCreate:()=>void;onView:(id:string)=>void}){
  const [selected,setSelected]=useState<string|undefined>(undefined);
  const person=subjects.find(s=>s.id===selected);
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">QUIÉNES APARECEN</span><div className="intro-actions"><h1>Personas y mascotas</h1><button className="btn primary" onClick={onCreate}><Plus size={16}/> Añadir</button></div></div>
    {subjects.length?<div className="subjects-grid">{subjects.map(s=><button key={s.id} className={'subject-card '+(selected===s.id?'selected':'')} onClick={()=>setSelected(s.id)}><div className="subject-avatar">{s.kind==='animal'?<PawPrint/>:<Users/>}</div><strong>{s.name}</strong><small>{photos.filter(p=>p.subjectIds.includes(s.id)).length} fotos</small></button>)}</div>:<EmptyState title="Sin personas ni mascotas" description="Crea sus fichas y etiquétalas cuando importes fotos." onAction={onCreate} action="Añadir ficha"/>}
    {person&&<section className="panel"><SectionTitle title={`Fotos de ${person.name}`}/><PhotoGrid photos={orderPhotos(photos.filter(p=>p.subjectIds.includes(person.id)))} onView={onView}/></section>}
  </div>;
}

export function SearchPage({photos,memories,onView,onOpen}:{photos:Photo[];memories:Memory[];onView:(id:string)=>void;onOpen:(id:string)=>void}){
  const [query,setQuery]=useState('');
  const q=query.trim().toLocaleLowerCase('es');
  const results=q?photos.filter(p=>[p.filename,p.description,p.place,p.takenOn].join(' ').toLocaleLowerCase('es').includes(q)):[];
  const memoriesFound=q?memories.filter(m=>[m.title,m.description,m.place].join(' ').toLocaleLowerCase('es').includes(q)):[];
  return <div className="page-stack"><div className="page-intro"><h1>Buscar recuerdos</h1><p>Encuentra fotografías por fecha, nombre o lugar, y recuerdos por título.</p></div><label className="search-field"><Search size={19}/><input autoFocus placeholder="Buscar en Amorchi..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {q&&<><SectionTitle title={`Recuerdos (${memoriesFound.length})`}/><div className="location-list">{memoriesFound.map(m=><button key={m.id} onClick={()=>onOpen(m.id)}><Star size={18}/>{m.title}<ArrowRight size={16}/></button>)}</div><SectionTitle title={`Fotografías (${results.length})`}/><PhotoGrid photos={results} onView={onView}/></>}
  </div>;
}

export function SettingsPage({pending,settings,onSaveSettings}:{pending:number;settings:AppSettings;onSaveSettings:(settings:AppSettings)=>Promise<void>}){
  const [bytes,setBytes]=useState(0);
  const [quota,setQuota]=useState<number|undefined>();
  const [persistent,setPersistent]=useState<boolean|undefined>();
  const [error,setError]=useState('');
  useEffect(()=>{getLocalUsage().then(v=>{setBytes(v.bytes);setQuota(v.quota);}).catch(e=>setError(String(e)));navigator.storage?.persisted?.()?.then(setPersistent).catch(()=>undefined);},[]);
  const format=(n:number)=>n>1024**3?(n/1024**3).toFixed(2)+' GB':(n/1024**2).toFixed(1)+' MB';
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">ALMACENAMIENTO Y SEGURIDAD</span><h1>Ajustes</h1><p>Estado de tu biblioteca en este dispositivo.</p></div>
    <SpecialDatesSettings settings={settings} onSave={onSaveSettings}/>
    <div className="settings-cards"><section className="panel"><h3><HardDrive size={20}/> Biblioteca offline</h3><p className="large-stat">{format(bytes)}</p><p>Fotografías originales y variantes guardadas localmente.</p>{quota!==undefined&&<small>Cuota estimada del navegador: {format(quota)}</small>}
      <button className="btn subtle" onClick={async()=>{const ok=await requestPersistence();setPersistent(ok);}}><ShieldCheck size={16}/>{persistent?'Almacenamiento persistente concedido':'Solicitar almacenamiento persistente'}</button>
    </section><section className="panel"><h3><CloudUpload size={20}/> Cola de sincronización</h3><p className="large-stat">{pending}</p><p>Operaciones pendientes en este dispositivo.</p><div className="warning-note">El servidor todavía no está conectado. Estas operaciones NO se han subido y podrían perderse si el navegador elimina sus datos.</div></section></div>
    <section className="panel"><h3>Estado del proyecto</h3><p>La sesión por correo electrónico y la sincronización con PostgreSQL estarán disponibles cuando se implemente la API doméstica. No hay autenticación ni copias de seguridad automáticas en esta versión.</p><p>Para una instalación segura en móviles de la misma Wi-Fi será necesario HTTPS fiable y un servidor accesible por dirección local.</p></section>
    {error&&<p role="alert" className="form-errors">{error}</p>}
  </div>;
}
