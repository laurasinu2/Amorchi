import { useEffect, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import './online-places.css';

export type LocationChoice = { label:string; latitude:number; longitude:number; id:string };
type PhotonFeature = {
  geometry?:{coordinates?:number[]};
  properties?:{osm_id?:number;osm_type?:string;name?:string;street?:string;housenumber?:string;city?:string;county?:string;state?:string;country?:string;postcode?:string};
};
type PhotonResponse = {features?:PhotonFeature[]};
function formatPlace(p:NonNullable<PhotonFeature['properties']>){
  const main=[p.name || [p.street,p.housenumber].filter(Boolean).join(' '),p.city,p.state,p.country].filter(Boolean);
  return [...new Set(main)].join(', ') || [p.county,p.country].filter(Boolean).join(', ');
}
export function LocationSearch({value,onSelect,placeholder='Buscar una ciudad, calle o lugar…'}:{
  value?:string;onSelect:(choice:LocationChoice)=>void;placeholder?:string;
}){
  const [query,setQuery]=useState(value||'');
  const [results,setResults]=useState<LocationChoice[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{
    const changed=()=>setOnline(navigator.onLine);
    window.addEventListener('online',changed);window.addEventListener('offline',changed);
    return ()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};
  },[]);
  useEffect(()=>setQuery(value||''),[value]);
  async function lookup(){
    if(!online){setMessage('La búsqueda necesita conexión a Internet.');return;}
    const q=query.trim();
    if(q.length<3){setMessage('Escribe al menos tres caracteres.');return;}
    setLoading(true);setMessage('');setResults([]);
    try{
      const response=await fetch('https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'7',lang:'es'}),{
        signal:AbortSignal.timeout(10000),cache:'no-store'
      });
      if(!response.ok)throw new Error('La búsqueda no está disponible en este momento.');
      const data:PhotonResponse=await response.json();
      const choices=(data.features||[]).flatMap(item=>{
        const pair=item.geometry?.coordinates,p=item.properties;
        if(!p || !pair || pair.length<2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]))return [];
        const label=formatPlace(p);
        if(!label)return [];
        return [{label,longitude:pair[0],latitude:pair[1],id:`osm:${p.osm_type||'place'}:${p.osm_id||label}`}];
      });
      setResults(choices);
      if(!choices.length)setMessage('No se encontraron lugares. Prueba con otra búsqueda.');
    }catch(err){setMessage(err instanceof Error?err.message:'No se pudo buscar el lugar.');}
    finally{setLoading(false);}
  }
  return <div className="memrly-online-place-search">
    <div className="memrly-place-query">
      <Search size={17}/>
      <input aria-label="Buscar localización" value={query} maxLength={160} placeholder={placeholder} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void lookup();}}} disabled={!online}/>
      <button type="button" onClick={()=>void lookup()} disabled={!online||loading||query.trim().length<3}>{loading?'Buscando…':'Buscar'}</button>
    </div>
    {!online&&<p className="memrly-place-note" role="status">Sin conexión. Los lugares ya guardados se mantienen, pero no se pueden buscar otros.</p>}
    {message&&<p className="memrly-place-note" role="status">{message}</p>}
    {!!results.length&&<div className="memrly-place-results" role="listbox" aria-label="Resultados de lugares">
      {results.map((place,i)=><button type="button" role="option" aria-selected={false} key={place.id+':'+i} onClick={()=>{onSelect(place);setQuery(place.label);setResults([]);setMessage('');}}>
        <MapPin size={17}/><span>{place.label}</span><small>Elegir</small>
      </button>)}
    </div>}
    <small className="memrly-place-credit">Resultados online de OpenStreetMap a través de Photon. Solo se guardan el nombre y las coordenadas del lugar elegido.</small>
  </div>;
}
