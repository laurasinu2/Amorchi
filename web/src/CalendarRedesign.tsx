import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Camera, ChevronDown, ChevronLeft, ChevronRight, FolderPlus, Heart, Image as ImageIcon, MapPin, Plane, Plus } from 'lucide-react';
import type { AppSettings, Memory, Photo } from './types';
import { dateLabel, kindName, localISO, monthLabel } from './dates';
import { holidaysOn } from './traditionalDates';
import { occasionsOn } from './specialDates';
import { CalendarGrid } from './components/CalendarGrid';
import { PhotoView } from './components/PhotoView';

export type CalendarMode='year'|'month'|'list';
const monthNames=Array.from({length:12},(_,m)=>new Intl.DateTimeFormat('es-ES',{month:'long'}).format(new Date(2025,m,1)));
type DayEntry={date:string;photos:Photo[];starts:Memory[];finishes:Memory[];specials:string[];holidays:string[]};

function monthKey(year:number,month:number){return `${year}-${String(month+1).padStart(2,'0')}`;}
function inPeriod(memory:Memory,start:string,end:string){return memory.startDate<=end&&memory.endDate>=start;}
function displayLocation(place:string,lat?:number,long?:number){
  if(place.trim())return place.trim();
  return typeof lat==='number'&&typeof long==='number'?`${lat.toFixed(3)}, ${long.toFixed(3)}`:'';
}

export function CalendarPage({year,month,mode,selectedDay,photos,memories,settings,onMode,onYear,onMonth,onDay,onViewPhoto,onAddPhotos,onCreateMemory,onAddToCollection}:{
  year:number;month:number;mode:CalendarMode;selectedDay:string;photos:Photo[];memories:Memory[];settings:AppSettings;
  onMode:(mode:CalendarMode)=>void;onYear:(year:number)=>void;onMonth:(year:number,month:number)=>void;onDay:(date:string)=>void;
  onViewPhoto:(id:string)=>void;onAddPhotos:(date:string)=>void;onCreateMemory:(date:string)=>void;onAddToCollection:(date:string)=>void;
}){
  const [jumpOpen,setJumpOpen]=useState(false);
  const [targetYear,setTargetYear]=useState(year);
  const [targetMonth,setTargetMonth]=useState(month);
  useEffect(()=>{setTargetYear(year);setTargetMonth(month);},[year,month]);
  const start=mode==='month'?`${monthKey(year,month)}-01`:`${year}-01-01`;
  const end=mode==='month'?localISO(new Date(year,month+1,0,12)):`${year}-12-31`;
  const periodPhotos=photos.filter(p=>p.takenOn>=start&&p.takenOn<=end);
  const periodMemories=memories.filter(m=>inPeriod(m,start,end));
  const periodTrips=periodMemories.filter(m=>m.kind==='trip');
  const periodOther=periodMemories.filter(m=>m.kind!=='trip');
  const periodPlaces=new Set<string>([
    ...periodPhotos.map(p=>displayLocation(p.place,p.latitude,p.longitude)),
    ...periodMemories.map(m=>displayLocation(m.place,m.latitude,m.longitude))
  ].filter(Boolean));
  const dayPhotos=photos.filter(p=>p.takenOn===selectedDay).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const dayMemories=memories.filter(m=>m.startDate<=selectedDay&&m.endDate>=selectedDay);
  const daySpecials=occasionsOn(selectedDay,settings);
  const dayHolidays=settings.showTraditions===false?[]:holidaysOn(selectedDay);
  const dayPlace=displayLocation(dayPhotos.find(p=>p.place)?.place||'',dayPhotos[0]?.latitude,dayPhotos[0]?.longitude)||
    (dayMemories.find(m=>m.place)?.place||'Sin ubicación');
  const monthTitle=monthLabel(year,month);
  const list=useMemo(()=>{
    if(mode!=='list')return [];
    const entries=new Map<string,DayEntry>();
    function add(date:string){
      if(date<`${year}-01-01`||date>`${year}-12-31`)return undefined;
      if(!entries.has(date))entries.set(date,{date,photos:[],starts:[],finishes:[],specials:[],holidays:[]});
      return entries.get(date)!;
    }
    for(const p of photos){add(p.takenOn)?.photos.push(p);}
    for(const m of memories){
      add(m.startDate)?.starts.push(m);
      if(m.endDate!==m.startDate)add(m.endDate)?.finishes.push(m);
    }
    // Las fechas tradicionales y personales también forman parte de la agenda.
    for(let d=new Date(year,0,1,12);d.getFullYear()===year;d.setDate(d.getDate()+1)){
      const date=localISO(d);
      const holidays=settings.showTraditions===false?[]:holidaysOn(date);
      const specials=occasionsOn(date,settings);
      if(holidays.length||specials.length){
        const item=add(date)!;
        item.holidays.push(...holidays.map(h=>h.title));
        item.specials.push(...specials.map(s=>s.label));
      }
    }
    return [...entries.values()].sort((a,b)=>b.date.localeCompare(a.date));
  },[year,mode,photos,memories,settings]);

  function goToPeriod(y:number,m:number){
    if(mode==='year'||mode==='list'){
      onYear(y);
      if(mode==='list')onMode('list');
    }else onMonth(y,m);
    setJumpOpen(false);
  }
  function shift(delta:number){
    if(mode==='year'||mode==='list')goToPeriod(year+delta,month);
    else {
      const target=new Date(year,month+delta,1,12);
      goToPeriod(target.getFullYear(),target.getMonth());
    }
  }
  function jump(){
    if(!Number.isInteger(targetYear)||targetYear<1800||targetYear>4100)return;
    goToPeriod(targetYear,targetMonth);
  }
  function selectDate(day:string){
    if(mode==='year')onMonth(Number(day.slice(0,4)),Number(day.slice(5,7))-1);
    onDay(day);
  }
  return <div className="memrly-screen memrly-calendar-screen">
    <header className="memrly-screen-intro"><h1>Calendario fotográfico</h1><p>Descubre tus fotografías, viajes y recuerdos por fecha.</p></header>
    <div className="memrly-calendar-workspace">
      <section className="memrly-calendar-main memrly-panel">
        <div className="memrly-calendar-toolbar">
          <div className="memrly-calendar-period">
            <button type="button" className="memrly-nav-round" aria-label="Periodo anterior" onClick={()=>shift(-1)}><ChevronLeft size={19}/></button>
            <div className="memrly-date-jump-wrap">
              <button type="button" className="memrly-date-jump" onClick={()=>setJumpOpen(v=>!v)} aria-expanded={jumpOpen} aria-haspopup="dialog">
                {mode==='month'?monthTitle:year}<ChevronDown size={16}/>
              </button>
              {jumpOpen&&<div className="memrly-jump-popover" role="dialog" aria-label="Elegir mes y año">
                <label>Año<input type="number" min="1800" max="4100" value={targetYear} onChange={e=>setTargetYear(Number(e.target.value))}/></label>
                {mode==='month'&&<label>Mes<select value={targetMonth} onChange={e=>setTargetMonth(Number(e.target.value))}>{monthNames.map((m,i)=><option value={i} key={i}>{m}</option>)}</select></label>}
                <button type="button" className="btn primary" onClick={jump} disabled={targetYear<1800||targetYear>4100}>Ir a fecha</button>
              </div>}
            </div>
            <button type="button" className="memrly-nav-round" aria-label="Periodo siguiente" onClick={()=>shift(1)}><ChevronRight size={19}/></button>
          </div>
          <div className="memrly-calendar-switch" aria-label="Vista del calendario">
            <button className={mode==='year'?'active':''} onClick={()=>onMode('year')} aria-pressed={mode==='year'}>Año</button>
            <button className={mode==='month'?'active':''} onClick={()=>onMode('month')} aria-pressed={mode==='month'}>Mes</button>
            <button className={mode==='list'?'active':''} onClick={()=>onMode('list')} aria-pressed={mode==='list'}>Lista</button>
          </div>
        </div>

        {mode==='month'&&<div className="memrly-month-calendar">
          <CalendarGrid year={year} month={month} selectedDay={selectedDay} photos={photos} memories={memories} settings={settings} onDay={selectDate}/>
          <div className="memrly-calendar-key"><span><i/>Foto</span><span><i/>Viaje o evento</span><span><i/>Día seleccionado</span></div>
        </div>}

        {mode==='year'&&<div className="memrly-mini-months">
          {monthNames.map((name,m)=><article key={m} className="memrly-mini-month">
            <button type="button" className="memrly-mini-month-title" onClick={()=>onMonth(year,m)}>{name}<ChevronRight size={13}/></button>
            <CalendarGrid year={year} month={m} photos={photos} memories={memories} settings={settings} compact selectedDay={selectedDay} onDay={selectDate}/>
          </article>)}
        </div>}

        {mode==='list'&&<div className="memrly-date-list">
          {list.length?list.map(item=><button type="button" key={item.date} className={'memrly-date-row '+(selectedDay===item.date?'active':'')} onClick={()=>onDay(item.date)}>
            <div className="memrly-date-row-text">
              <strong>{dateLabel(item.date)}</strong>
              <div className="memrly-date-row-labels">
                {item.starts.map(m=><span key={'s'+m.id}>{kindName(m.kind)}: {m.title}</span>)}
                {item.finishes.map(m=><span key={'e'+m.id}>Finaliza {kindName(m.kind).toLowerCase()}: {m.title}</span>)}
                {item.holidays.slice(0,2).map((h,i)=><span key={'h'+i}>{h}</span>)}
                {item.specials.slice(0,2).map((s,i)=><span key={'p'+i}>{s}</span>)}
              </div>
            </div>
            {item.photos[0]&&<PhotoView id={item.photos[0].id} className="memrly-date-row-image"/>}
            {item.photos.length>0&&<small>{item.photos.length} fotos</small>}
            <ChevronRight size={15}/>
          </button>):<p className="muted-text">Todavía no hay elementos en este año.</p>}
        </div>}
      </section>

      <aside className="memrly-calendar-side">
        <section className="memrly-panel memrly-calendar-overview">
          <h2>Resumen {mode==='month'?'del mes':'del año'}</h2>
          <p>{mode==='month'?monthTitle:`Año ${year}`}</p>
          <div className="memrly-calendar-kpis">
            <div><ImageIcon size={22}/><strong>{periodPhotos.length}</strong><span>Fotografías</span></div>
            <div><Plane size={22}/><strong>{periodTrips.length}</strong><span>Viajes</span></div>
            <div><Heart size={22}/><strong>{periodOther.length}</strong><span>Recuerdos</span></div>
            <div><MapPin size={22}/><strong>{periodPlaces.size}</strong><span>Lugares</span></div>
          </div>
        </section>

        <section className="memrly-panel memrly-selected-day">
          <h2>Día seleccionado</h2>
          <p className="memrly-day-subtitle">{dateLabel(selectedDay)}</p>
          <div className="memrly-day-main-photo">{dayPhotos.length?
            <PhotoView id={dayPhotos[0].id} quality="preview" onClick={()=>onViewPhoto(dayPhotos[0].id)} className="memrly-day-preview"/>:
            <div className="memrly-day-preview memrly-image-placeholder"><Camera size={27}/><span>Sin foto para este día</span></div>}
          </div>
          <div className="memrly-day-info">
            <div><Plane size={17}/><span>{dayMemories.length?dayMemories.map(m=>`${kindName(m.kind)}: ${m.title}`).join(' · '):'Sin viaje ni recuerdo asociado'}</span></div>
            <div><ImageIcon size={17}/><span>{dayPhotos.length} {dayPhotos.length===1?'fotografía':'fotografías'}</span></div>
            <div><MapPin size={17}/><span>{dayPlace}</span></div>
          </div>
          {(daySpecials.length>0||dayHolidays.length>0)&&<div className="memrly-day-holidays">
            {[...daySpecials.map(x=>x.label),...dayHolidays.map(x=>x.title)].map((value,i)=><span key={i}>{value}</span>)}
          </div>}
        </section>

        <section className="memrly-panel memrly-calendar-actions">
          <h2>Acciones rápidas</h2>
          <button type="button" onClick={()=>onAddPhotos(selectedDay)}><Camera size={18}/> Añadir fotos a este día <Plus size={16}/></button>
          <button type="button" onClick={()=>onCreateMemory(selectedDay)}><Heart size={18}/> Crear un recuerdo <Plus size={16}/></button>
          <button type="button" disabled={!dayPhotos.length} title={!dayPhotos.length?'Este día no tiene fotografías todavía':undefined} onClick={()=>onAddToCollection(selectedDay)}><FolderPlus size={18}/> Añadir a colección <ArrowRight size={16}/></button>
        </section>
      </aside>
    </div>
  </div>;
}
