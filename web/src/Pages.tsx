import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, ChevronLeft, ChevronRight, CloudUpload, Globe2, HardDrive, Heart, ImagePlus, MapPin, PawPrint, Plane, Plus, Search, ShieldCheck, Star, Trash2, Users } from 'lucide-react';
import type { AppSettings, Memory, Page, Photo, Subject } from './types';
import { addDays, dateLabel, kindName, monthLabel } from './dates';
import { getLocalUsage, requestPersistence } from './db';
import { CalendarGrid } from './components/CalendarGrid';
import { PhotoView } from './components/PhotoView';
import { WorldMap } from './components/WorldMap';
import { CoverMenu } from './components/CoverPicker';
import { SpecialDatesSettings } from './components/SpecialDatesSettings';
import { occasionsOn } from './specialDates';
import { holidaysOn } from './traditionalDates';

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
const yearsOf=(photos:Photo[],memories:Memory[])=>[...new Set([...photos.map(p=>Number(p.takenOn.slice(0,4))),...memories.map(m=>Number(m.startDate.slice(0,4))),new Date().getFullYear()])].sort((a,b)=>b-a);
function MemoryCard({memory,photos,onOpen}:{memory:Memory;photos:Photo[];onOpen:(id:string)=>void}){
  const cover=coverOf(memory,photos);
  return <button className="memory-card" onClick={()=>onOpen(memory.id)}>
    {cover?<PhotoView id={cover} className="memory-cover"/>:<span className={'memory-cover placeholder '+memory.kind}>{memory.kind==='trip'?'✈':memory.kind==='event'?'✦':'♡'}</span>}
    <span className="memory-card-content"><span className="pill kind">{kindName(memory.kind)}</span><strong>{memory.title}</strong><small><CalendarDays size={13}/>{dateLabel(memory.startDate,'short')}{memory.endDate!==memory.startDate?' · '+dateLabel(memory.endDate,'short'):''}</small>{memory.place&&<small><MapPin size={13}/>{memory.place}</small>}</span>
  </button>;
}

export function Dashboard({photos,memories,settings,onNavigate,onOpenMemory,onViewPhoto,onImport,onCreateMemory,onChangeCover}:{
  photos:Photo[];memories:Memory[];settings:AppSettings;onNavigate:(page:Page)=>void;onOpenMemory:(id:string)=>void;onViewPhoto:(id:string)=>void;onImport:()=>void;onCreateMemory:()=>void;onChangeCover:()=>void;
}){
  const newest=orderPhotos(photos);
  const homeCover=photos.find(p=>p.id===settings.homeCoverPhotoId)||newest[0];
  const trips=[...memories].filter(m=>m.kind==='trip').sort((a,b)=>b.startDate.localeCompare(a.startDate));
  const years=yearsOf(photos,memories);
  return <div className="page-stack">
    <section className="dashboard-hero">
      {homeCover&&<PhotoView id={homeCover.id} quality="preview" className="dashboard-hero-image"/>}
      <div className="hero-content"><div className="hero-copy"><h1>Nuestra historia <em>♡</em></h1><p>Fotos, viajes y momentos.</p></div><button className="btn light hero-years" onClick={()=>onNavigate('anios')}>Ver años <ArrowRight size={17}/></button></div>
      <CoverMenu onChange={onChangeCover}/>
    </section>
    <div className="stat-grid"><div className="stat"><CalendarDays/><strong>{years.length}</strong><span>Años</span></div><div className="stat"><Camera/><strong>{photos.length}</strong><span>Fotografías</span></div><div className="stat"><Plane/><strong>{trips.length}</strong><span>Viajes</span></div><div className="stat"><Heart/><strong>{memories.filter(m=>m.kind!=='trip').length}</strong><span>Recuerdos</span></div></div>
    <div className="quick-actions"><button onClick={()=>onNavigate('calendario')}><CalendarDays size={24}/><span><strong>Calendario fotográfico</strong><small>Revive vuestra historia día a día</small></span><ArrowRight size={16}/></button><button onClick={onImport}><ImagePlus size={24}/><span><strong>Subir fotografías</strong><small>Añade recuerdos incluso sin conexión</small></span><ArrowRight size={16}/></button></div>
    <SectionTitle title="Fotografías recientes" action="Ver álbum" onAction={()=>onNavigate('album')}/>
    {photos.length?<div className="recent-row">{newest.slice(0,9).map(p=><PhotoView key={p.id} id={p.id} onClick={()=>onViewPhoto(p.id)} className="recent-photo"/>)}</div>:<EmptyState title="Vuestra historia empieza aquí" description="Importa las primeras fotografías. Se guardarán en el dispositivo incluso si el servidor está apagado." onAction={onImport} action="Subir primeras fotos"/>}
    <SectionTitle title="Viajes y escapadas" action="Ver viajes" onAction={()=>onNavigate('viajes')}/>
    {trips.length?<div className="memory-cards">{trips.slice(0,3).map(m=><MemoryCard key={m.id} memory={m} photos={photos} onOpen={onOpenMemory}/>)}</div>:<EmptyState title="Todavía no hay viajes" description="Crea un viaje con sus fechas y después asocia las fotos." onAction={onCreateMemory} action="Crear un recuerdo"/>}
    <SectionTitle title="Un mundo de recuerdos" action="Abrir mapa" onAction={()=>onNavigate('lugares')}/>
    <div className="world-teaser"><Globe2 size={32}/><div><h3>Los lugares de nuestra historia</h3><p>Viajes, eventos y momentos agrupados en un mapa mundial.</p></div><button className="btn subtle" onClick={()=>onNavigate('lugares')}>Explorar mapa <ArrowRight size={15}/></button></div>
  </div>;
}

export function YearsPage({photos,memories,settings,onYear,onChangeCover}:{photos:Photo[];memories:Memory[];settings:AppSettings;onYear:(year:number)=>void;onChangeCover:(year:number)=>void}){
  const years=yearsOf(photos,memories);
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">ARCHIVO CRONOLÓGICO</span><h1>Nuestros años ♡</h1><p>Cada año guarda sus propios viajes, lugares y fotografías.</p></div>
    <div className="year-cards">{years.map(y=>{
      const photo=photos.find(p=>p.id===settings.yearCoverPhotoIds?.[String(y)])||photos.find(p=>p.takenOn.startsWith(String(y)));
      const count=photos.filter(p=>p.takenOn.startsWith(String(y))).length;
      const yearMem=memories.filter(m=>m.startDate.slice(0,4)===String(y));
      return <article key={y} className="year-card">
        <button type="button" className="year-card-main" onClick={()=>onYear(y)}>
          {photo?<PhotoView id={photo.id} className="year-cover"/>:<span className="year-cover placeholder">♡</span>}
          <span><strong>{y}</strong><small>{count} fotos · {yearMem.length} recuerdos</small><span className="year-tags">{yearMem.slice(0,2).map(m=><span className={'pill '+m.kind} key={m.id}>{m.kind==='trip'?'✈ ': '♡ '}{m.title}</span>)}</span></span><ArrowRight size={22}/>
        </button>
        <CoverMenu onChange={()=>onChangeCover(y)}/>
      </article>;
    })}</div>
  </div>;
}

export type CalendarMode='year'|'month'|'day';
export function CalendarPage({year,month,mode,selectedDay,photos,memories,settings,onMode,onYear,onMonth,onDay,onViewPhoto}:{
  year:number;month:number;mode:CalendarMode;selectedDay:string;photos:Photo[];memories:Memory[];settings:AppSettings;
  onMode:(m:CalendarMode)=>void;onYear:(y:number)=>void;onMonth:(year:number,month:number)=>void;onDay:(iso:string)=>void;onViewPhoto:(id:string)=>void;
}){
  const dayPhotos=orderPhotos(photos.filter(p=>p.takenOn===selectedDay));
  const dayMemories=memories.filter(m=>m.startDate<=selectedDay&&m.endDate>=selectedDay);
  const daySpecials=occasionsOn(selectedDay,settings);
  const dayHolidays=settings.showTraditions===false?[]:holidaysOn(selectedDay);
  function shift(delta:number){
    if(mode==='year')onYear(year+delta);
    else if(mode==='month'){const date=new Date(year,month+delta,1,12);onMonth(date.getFullYear(),date.getMonth());}
    else onDay(addDays(selectedDay,delta));
  }
  return <div className="page-stack">
    <div className="segmented calendar-tabs"><button className={mode==='year'?'active':''} onClick={()=>onMode('year')}>Año</button><button className={mode==='month'?'active':''} onClick={()=>onMode('month')}>Mes</button><button className={mode==='day'?'active':''} onClick={()=>onMode('day')}>Día</button></div>
    <div className="calendar-title"><button className="icon-button" onClick={()=>shift(-1)} aria-label="Anterior"><ChevronLeft/></button><h1><CalendarDays/>{mode==='year'?year:mode==='month'?monthLabel(year,month):dateLabel(selectedDay)}</h1><button className="icon-button" onClick={()=>shift(1)} aria-label="Siguiente"><ChevronRight/></button></div>
    {mode==='year'&&<div className="months-grid">{Array.from({length:12},(_,m)=><section className="month-card" key={m}>
      <button className="month-heading" onClick={()=>onMonth(year,m)}><strong>{new Intl.DateTimeFormat('es-ES',{month:'long'}).format(new Date(year,m,1))}</strong><small><Camera size={12}/>{photos.filter(p=>p.takenOn.startsWith(`${year}-${String(m+1).padStart(2,'0')}`)).length}</small></button>
      <CalendarGrid year={year} month={m} compact photos={photos} memories={memories} settings={settings} onDay={onDay}/>
    </section>)}</div>}
    {mode==='month'&&<div className="month-wide"><CalendarGrid year={year} month={month} selectedDay={selectedDay} photos={photos} memories={memories} settings={settings} onDay={onDay}/><div className="calendar-legend"><span><i className="legend-photo"/>Día con foto</span><span><i className="legend-trip"/>Viaje</span><span><i className="legend-event"/>Evento / momento</span><span><i className="legend-anniversary"/>Aniversario de pareja</span><span>🎂 Cumpleaños</span><span className="legend-themed">✶ Navidad · <b>naranja</b></span><span className="legend-themed">✿ Semana Santa · <b>verde</b></span><span className="legend-themed">🎭 Carnaval · <b>morado</b></span><span className="legend-themed">🍂 Otoño · <b>cobre</b></span><span className="legend-themed">↔ Puente posible · <b>azul</b></span><span className="legend-themed">🤭 Santos Inocentes · <b>rosa</b></span></div></div>}
    {mode==='day'&&<div className="day-layout">{dayHolidays.length>0&&<div className="panel day-special-panel">
      <SectionTitle title="Celebraciones y tradiciones"/>{dayHolidays.map(h=><div key={h.id} className={'traditional-day-event holiday-'+h.theme}><span>{h.theme==='christmas'?'✶':h.theme==='carnival'?'🎭':h.theme==='pranks'?'🤭':h.theme==='autumn'?'🍂':h.theme==='spring'?'✿':h.theme==='bridge'?'↔':'★'}</span><strong>{h.title}</strong>{h.status==='optional-bridge'&&<small>No es festivo laboral automático</small>}</div>)}</div>}{daySpecials.length>0&&<div className="panel day-special-panel"><SectionTitle title="Fechas especiales"/>{daySpecials.map(item=><div key={item.id} className={'special-day-event '+item.type}><span className="special-day-icon">{item.type==='anniversary'?'♥':'🎂'}</span><strong>{item.label}</strong>{item.type==='anniversary'&&item.years!==undefined&&item.years>0&&<span className="special-day-count">{item.years}º</span>}</div>)}</div>}<div className="panel"><SectionTitle title="Fotos del día"/>{dayPhotos.length?<div className="day-preview">{dayPhotos.slice(0,6).map(p=><PhotoView key={p.id} id={p.id} className="day-photo" onClick={()=>onViewPhoto(p.id)}/>)}</div>:<p className="muted-text">Todavía no hay fotos de este día.</p>}</div><div className="panel"><SectionTitle title="Viajes y momentos"/>{dayMemories.length?dayMemories.map(m=><p className="event-row" key={m.id}><span className={'pill '+m.kind}>{kindName(m.kind)}</span><strong>{m.title}</strong></p>):<p className="muted-text">Ningún evento definido en esta fecha.</p>}</div></div>}
    {mode!=='year'&&<p className="helper-text">Pulsa un día del calendario para consultar sus recuerdos. Las franjas muestran eventos y viajes que pueden durar varios días.</p>}
  </div>;
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
    <section className="memory-hero">{cover&&<PhotoView id={cover} quality="preview" className="memory-hero-image"/>}
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
