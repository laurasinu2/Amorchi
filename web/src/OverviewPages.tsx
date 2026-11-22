import { useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, Heart, Image as ImageIcon, Images, Plane } from 'lucide-react';
import type { AppSettings, CoverPosition, Memory, MemoryKind, Page, Photo } from './types';
import { PhotoView } from './components/PhotoView';
import { CoverMenu } from './components/CoverPicker';

const datedPhotos=(photos:Photo[])=>[...photos].sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt));
const datedMemories=(memories:Memory[])=>[...memories].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.startDate.localeCompare(a.startDate));
const intersectYear=(m:Memory,y:number)=>m.startDate<=`${y}-12-31`&&m.endDate>=`${y}-01-01`;
function yearsWithData(photos:Photo[],memories:Memory[]):number[]{
  const years=new Set<number>(photos.map(p=>Number(p.takenOn.slice(0,4))).filter(Number.isFinite));
  for(const m of memories){
    const start=Number(m.startDate.slice(0,4)),end=Number(m.endDate.slice(0,4));
    if(start<1800||end>4100||start>end)continue;
    for(let y=start;y<=end;y++)years.add(y);
  }
  return [...years].sort((a,b)=>b-a);
}
function yearCounts(y:number,photos:Photo[],memories:Memory[]){
  return {
    photos:photos.filter(p=>p.takenOn.startsWith(String(y))),
    trips:memories.filter(m=>m.kind==='trip'&&intersectYear(m,y)),
    memories:memories.filter(m=>m.kind!=='trip'&&intersectYear(m,y))
  };
}
function stablePhoto(memory:Memory,photos:Photo[]){
  const options=photos.filter(p=>p.memoryIds.includes(memory.id));
  if(memory.coverPhotoId&&photos.some(p=>p.id===memory.coverPhotoId))return memory.coverPhotoId;
  if(!options.length)return;
  const hash=[...memory.id].reduce((sum,ch)=>(sum*31+ch.charCodeAt(0))>>>0,7);
  return options[hash%options.length].id;
}

export function MiniStat({icon:Icon,value,label}:{icon:typeof CalendarDays;value:number;label:string}){
  return <div className="memrly-stat"><Icon className="memrly-stat-icon" aria-hidden="true"/><div className="memrly-stat-info"><strong>{value.toLocaleString('es-ES')}</strong><span>{label}</span></div></div>;
}

function SectionHeader({title,action,onClick}:{title:string;action?:string;onClick?:()=>void}){
  return <div className="memrly-heading"><h2>{title}</h2>{action&&onClick&&<button type="button" className="memrly-section-action" onClick={onClick}>{action}<ArrowRight size={16}/></button>}</div>;
}

function FeatureCard({memory,photos,onOpen}:{
  memory?:Memory;photos:Photo[];onOpen:(id:string)=>void;
}){
  if(!memory)return <div className="memrly-feature-empty"><Heart size={27}/><strong>Todavía no hay recuerdos aquí</strong><span>Cuando crees uno, aparecerá en este espacio.</span></div>;
  const id=stablePhoto(memory,photos);
  const Icon=memory.kind==='trip'?Plane:Heart;
  return <div className="memrly-feature-card">
    {id?<PhotoView id={id} quality="preview" focalPoint={memory.coverPhotoId===id?memory.coverPosition:undefined} className="memrly-feature-image"/>:<div className="memrly-feature-image memrly-image-placeholder"><Icon size={35}/></div>}
    <div className="memrly-feature-info">
      <span className="memrly-type"><Icon size={14}/>{memory.kind==='trip'?'Viaje':memory.kind==='event'?'Evento':'Recuerdo'}</span>
      <h3>{memory.title}</h3>
      <p>{memory.description||memory.place||'Un momento de nuestra historia para recordar.'}</p>
      <button className="memrly-link-button" type="button" onClick={()=>onOpen(memory.id)}>Ver {memory.kind==='trip'?'viaje':'recuerdo'}<ArrowRight size={16}/></button>
    </div>
  </div>;
}

export function Dashboard({photos,memories,settings,onNavigate,onOpenMemory,onViewPhoto,onImport,onCreateMemory,onChangeCover}:{
  photos:Photo[];memories:Memory[];settings:AppSettings;
  onNavigate:(page:Page)=>void;onOpenMemory:(id:string)=>void;onViewPhoto:(id:string)=>void;
  onImport:()=>void;onCreateMemory:(kind?:MemoryKind)=>void;onChangeCover:()=>void;
}){
  const newest=datedPhotos(photos);
  const cover=photos.find(p=>p.id===settings.homeCoverPhotoId)||newest[0];
  const years=yearsWithData(photos,memories);
  const trips=datedMemories(memories.filter(m=>m.kind==='trip'));
  const highlights=datedMemories(memories.filter(m=>m.kind!=='trip'));
  return <div className="memrly-screen memrly-home">
    <section className="dashboard-hero memrly-home-cover">
      {cover&&<PhotoView id={cover.id} quality="preview" focalPoint={settings.homeCoverPhotoId===cover.id?settings.homeCoverPosition:undefined} className="dashboard-hero-image"/>}
      <div className="hero-content"><div className="hero-copy"><h1>Nuestros recuerdos</h1><p>Todos nuestros momentos, en un solo lugar.</p></div></div>
      <CoverMenu onChange={onChangeCover}/>
    </section>

    <div className="memrly-stats-four">
      <MiniStat icon={CalendarDays} value={years.length} label="Años"/>
      <MiniStat icon={ImageIcon} value={photos.length} label="Fotografías"/>
      <MiniStat icon={Plane} value={trips.length} label="Viajes"/>
      <MiniStat icon={Heart} value={highlights.length} label="Recuerdos / eventos"/>
    </div>

    <div className="memrly-quick-two">
      <div className="memrly-quick-tile is-soon" aria-label="Resumen anual próximamente">
        <CalendarDays size={23}/><span><strong>Resumen anual</strong><small>Revive lo mejor de cada año · Próximamente</small></span><ChevronRight size={19}/>
      </div>
      <button type="button" className="memrly-quick-tile" onClick={onImport}>
        <Images size={23}/><span><strong>Subir fotos</strong><small>Añade nuevos recuerdos a Memrly</small></span><ChevronRight size={19}/>
      </button>
    </div>

    <section className="memrly-section">
      <SectionHeader title="Fotografías recientes" action="Ver todas" onClick={()=>onNavigate('album')}/>
      {newest.length?<div className="memrly-recents">{newest.slice(0,9).map(p=><PhotoView key={p.id} id={p.id} className="memrly-recent-photo" onClick={()=>onViewPhoto(p.id)}/>)}</div>:
      <div className="memrly-empty-row"><Images size={25}/><span>Aún no hay fotografías. Puedes añadir las primeras desde «Subir fotos».</span><button type="button" className="memrly-link-button" onClick={onImport}>Importar<ArrowRight size={15}/></button></div>}
    </section>

    <div className="memrly-feature-grid">
      <section className="memrly-feature-section"><SectionHeader title="Viajes destacados" action="Ver viajes" onClick={()=>onNavigate('viajes')}/>
        {trips.length?<FeatureCard memory={trips[0]} photos={photos} onOpen={onOpenMemory}/>:<div className="memrly-feature-empty"><Plane/><strong>Sin viajes todavía</strong><button type="button" className="memrly-link-button" onClick={()=>onCreateMemory('trip')}>Crear viaje<ArrowRight size={15}/></button></div>}
      </section>
      <section className="memrly-feature-section"><SectionHeader title="Recuerdos destacados" action="Ver todos" onClick={()=>onNavigate('recuerdos')}/>
        {highlights.length?<FeatureCard memory={highlights[0]} photos={photos} onOpen={onOpenMemory}/>:<div className="memrly-feature-empty"><Heart/><strong>Sin recuerdos todavía</strong><button type="button" className="memrly-link-button" onClick={()=>onCreateMemory('moment')}>Crear recuerdo<ArrowRight size={15}/></button></div>}
      </section>
    </div>
  </div>;
}

function YearCard({year,photos,memories,settings,onYear,onChangeCover}:{
  year:number;photos:Photo[];memories:Memory[];settings:AppSettings;
  onYear:(year:number)=>void;onChangeCover:(year:number)=>void;
}){
  const stats=yearCounts(year,photos,memories);
  const candidates=datedPhotos(stats.photos);
  const cover=photos.find(p=>p.id===settings.yearCoverPhotoIds?.[String(year)])
    ||(candidates.length?candidates[(Math.imul(year,2654435761)>>>0)%candidates.length]:undefined);
  const position:CoverPosition|undefined=cover?.id===settings.yearCoverPhotoIds?.[String(year)]?settings.yearCoverPositions?.[String(year)]:undefined;
  return <article className="memrly-year-card">
    <div className="memrly-year-photo-wrap">
      {cover?<PhotoView id={cover.id} quality="preview" focalPoint={position} className="memrly-year-photo"/>:<div className="memrly-year-photo memrly-image-placeholder"><CalendarDays size={35}/></div>}
      <strong className="memrly-year-number">{year}</strong><CoverMenu onChange={()=>onChangeCover(year)}/>
    </div>
    <div className="memrly-year-metrics">
      <MiniStat icon={ImageIcon} value={stats.photos.length} label="Fotos"/>
      <MiniStat icon={Plane} value={stats.trips.length} label="Viajes"/>
      <MiniStat icon={Heart} value={stats.memories.length} label="Recuerdos"/>
    </div>
    <button type="button" className="memrly-year-cta" onClick={()=>onYear(year)}>Ver año<ArrowRight size={17}/></button>
  </article>;
}

export function YearsPage({photos,memories,settings,onYear,onChangeCover,onNavigate,onOpenMemory}:{
  photos:Photo[];memories:Memory[];settings:AppSettings;onYear:(year:number)=>void;
  onChangeCover:(year:number)=>void;onNavigate:(page:Page)=>void;onOpenMemory:(id:string)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  const years=yearsWithData(photos,memories);
  const trips=memories.filter(m=>m.kind==='trip');
  const highlights=datedMemories(memories.filter(m=>m.kind!=='trip')).slice(0,3);
  return <div className="memrly-screen memrly-years">
    <header className="memrly-screen-intro"><h1>Años</h1><p>Tus recuerdos organizados por año, de un vistazo.</p></header>
    <div className="memrly-year-top">
      <div className="memrly-year-cards">
        {years.slice(0,2).map(y=><YearCard key={y} year={y} photos={photos} memories={memories} settings={settings} onYear={onYear} onChangeCover={onChangeCover}/>)}
        {!years.length&&<div className="memrly-year-no-data"><CalendarDays size={30}/><strong>Tu historia empieza aquí</strong><span>Cuando añadas fotografías o recuerdos aparecerán los años.</span></div>}
      </div>
      <aside className="memrly-year-summary">
        <h2>Tu historia en Memrly</h2><p>Un resumen de todos tus años.</p>
        <div className="memrly-year-summary-stats">
          <MiniStat icon={ImageIcon} value={photos.length} label="Fotografías"/>
          <MiniStat icon={Plane} value={trips.length} label="Viajes"/>
          <MiniStat icon={Heart} value={memories.length-trips.length} label="Recuerdos"/>
        </div>
      </aside>
    </div>

    <section className="memrly-panel memrly-timeline-panel">
      <SectionHeader title="Tu línea de tiempo por años" action={expanded?'Mostrar menos':'Ver todos los años'} onClick={()=>setExpanded(v=>!v)}/>
      {years.length?<div className={'memrly-timeline '+(expanded?'expanded':'')}>
        {[...years].reverse().map((y,i)=><div className="memrly-timeline-unit" key={y}>
          {i===0&&<span className="memrly-timeline-dot"/>}
          <span className="memrly-timeline-line"/>
          <button type="button" className="memrly-timeline-year" onClick={()=>onYear(y)}>{y}</button>
          <span className="memrly-timeline-line"/>
          <span className="memrly-timeline-dot"/>
        </div>)}
      </div>:<p className="muted-text">Aquí verás tus años cuando haya información.</p>}
    </section>

    <section className="memrly-panel memrly-years-featured">
      <SectionHeader title="Recuerdos destacados" action="Ver todos" onClick={()=>onNavigate('recuerdos')}/>
      {highlights.length?<div className="memrly-featured-rows">{highlights.map(m=><button type="button" key={m.id} onClick={()=>onOpenMemory(m.id)} className="memrly-featured-small">
        {stablePhoto(m,photos)?<PhotoView id={stablePhoto(m,photos)!} className="memrly-featured-thumb"/>:<div className="memrly-featured-thumb memrly-image-placeholder"><Heart size={22}/></div>}
        <span><small>{m.kind==='event'?'Evento':'Recuerdo'}</small><strong>{m.title}</strong></span><ChevronRight size={17}/>
      </button>)}</div>:<p className="muted-text">Todavía no hay recuerdos destacados.</p>}
    </section>
  </div>;
}
