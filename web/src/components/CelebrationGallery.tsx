import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Heart, Images, Search } from 'lucide-react';
import type { AppSettings, Memory, Photo } from '../types';
import { celebrationCatalog, celebrationSeasons, hasCelebration } from '../celebrations';
import { dateLabel } from '../dates';
import { PhotoView } from './PhotoView';

/** Navegación dinámica por celebraciones. No almacena fotos nuevas ni reescribe asociaciones. */
export function CelebrationGallery({photos,memories,settings,onView,onlyFavorites=false}:{
  photos:Photo[];memories:Memory[];settings:AppSettings;onView:(id:string)=>void;onlyFavorites?:boolean;
}){
  const [celebrationId,setCelebrationId]=useState('');
  const [season,setSeason]=useState('');
  const [memoryId,setMemoryId]=useState('');
  const [term,setTerm]=useState('');
  const allCelebrations=useMemo(()=>celebrationCatalog(settings),[settings]);
  const choices=useMemo(()=>celebrationId?celebrationSeasons(photos,settings,celebrationId):[],[photos,settings,celebrationId]);
  const selected=allCelebrations.find(c=>c.id===celebrationId);
  const filtered=useMemo(()=>photos.filter(p=>{
    if(onlyFavorites&&!p.favorite)return false;
    if(memoryId&&!p.memoryIds.includes(memoryId))return false;
    if(celebrationId&&!hasCelebration(p,settings,celebrationId,season?Number(season):undefined))return false;
    const q=term.trim().toLocaleLowerCase('es');
    return !q||[p.filename,p.place,p.description,p.takenOn].join(' ').toLocaleLowerCase('es').includes(q);
  }).sort((a,b)=>b.takenOn.localeCompare(a.takenOn)||b.createdAt.localeCompare(a.createdAt)),[photos,onlyFavorites,memoryId,celebrationId,season,settings,term]);
  const days=new Map<string,Photo[]>();
  for(const p of filtered){const list=days.get(p.takenOn)||[];list.push(p);days.set(p.takenOn,list);}
  return <div className="page-stack celebration-gallery">
    <div className="page-intro"><span className="eyebrow">BIBLIOTECA FOTOGRÁFICA</span>
      <h1>{onlyFavorites?'Fotografías favoritas':'Todas nuestras fotografías'}</h1>
      <p>{filtered.length} fotografías · selecciona una celebración, una temporada o un viaje</p>
    </div>
    <section className="panel celebration-explorer">
      <div className="celebration-explorer-intro"><CalendarDays size={21}/><div><h2>Explorar celebraciones</h2>
        <p>Navidades, cumpleaños, aniversarios y otras fechas. Una fotografía puede estar relacionada con varios recuerdos y celebraciones.</p>
      </div></div>
      <div className="celebration-filters">
        <label><span>Celebración</span><select value={celebrationId} onChange={e=>{setCelebrationId(e.target.value);setSeason('');}}>
          <option value="">Todas las celebraciones</option>
          {allCelebrations.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}
        </select></label>
        <label><span>Temporada / año</span><select value={season} disabled={!celebrationId||!choices.length} onChange={e=>setSeason(e.target.value)}>
          <option value="">Todos los años</option>
          {choices.map(x=><option key={x.year} value={x.year}>{x.label} ({x.count})</option>)}
        </select></label>
        <label><span>Viaje, recuerdo o evento</span><select value={memoryId} onChange={e=>setMemoryId(e.target.value)}>
          <option value="">Todos los recuerdos</option>
          {[...memories].sort((a,b)=>a.title.localeCompare(b.title,'es')).map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
        </select></label>
        <label className="celebration-search"><span>Buscar fotografías</span><span className="celebration-search-input"><Search size={16}/><input placeholder="Lugar o descripción..." value={term} onChange={e=>setTerm(e.target.value)}/></span></label>
      </div>
      {selected&&<p className="celebration-active"><strong>{selected.title}</strong> · {selected.description} · {filtered.length} fotografías{season?' de '+(choices.find(x=>String(x.year)===season)?.label||season):''}</p>}
      <div className="celebration-shortcuts">
        {['navidades','carnaval','semana-santa','halloween','anniversary:relationship'].filter(id=>allCelebrations.some(c=>c.id===id)).map(id=>{
          const c=allCelebrations.find(x=>x.id===id)!;
          return <button type="button" key={id} className={'celebration-chip '+(celebrationId===id?'selected':'')} onClick={()=>{setCelebrationId(celebrationId===id?'':id);setSeason('');}}>{c.title}</button>;
        })}
        {(celebrationId||memoryId||term)&&<button type="button" className="celebration-clear" onClick={()=>{setCelebrationId('');setMemoryId('');setSeason('');setTerm('');}}>Limpiar filtros</button>}
      </div>
    </section>
    {filtered.length?[...days.entries()].map(([day,items])=><section key={day} className="panel photo-day-section">
      <div className="section-title"><h2>{dateLabel(day)}</h2><small>{items.length} fotos</small></div>
      <div className="photo-gallery">{items.map(p=><PhotoView key={p.id} id={p.id} className="gallery-photo" onClick={()=>onView(p.id)}>
        <span className="photo-overlay"><span>{p.takenTime||dateLabel(p.takenOn,'short')}</span>{p.favorite&&<Heart size={16} fill="currentColor"/>}</span>
      </PhotoView>)}</div>
    </section>):<div className="empty-state"><Images size={27}/><h3>No hay fotografías para estos filtros</h3><p>Prueba otra temporada o elimina un filtro. Las asociaciones se calculan desde la fecha EXIF, con las excepciones que hayas elegido.</p></div>}
  </div>;
}
