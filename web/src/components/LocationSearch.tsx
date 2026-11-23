import { useEffect, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import './online-places.css';

export type LocationChoice = { label:string; latitude:number; longitude:number; id:string };
type PhotonFeature = {
  geometry?:{coordinates?:number[]};
  properties?:{osm_id?:number;osm_type?:string;name?:string;street?:string;housenumber?:string;city?:string;county?:string;state?:string;country?:string};
};
type PhotonResponse = {features?:PhotonFeature[]};
type OpenMeteoResult = {
  id:number;name:string;latitude:number;longitude:number;
  admin1?:string;admin2?:string;country?:string;
};
type OpenMeteoResponse = {results?:OpenMeteoResult[]};
const cache = new Map<string,{places:LocationChoice[];provider:'photon'|'open-meteo'}>();

function formatPlace(p:NonNullable<PhotonFeature['properties']>) {
  const main=[p.name||[p.street,p.housenumber].filter(Boolean).join(' '),p.city,p.state,p.country].filter(Boolean);
  return [...new Set(main)].join(', ');
}
async function photonSearch(query:string):Promise<LocationChoice[]> {
  // Sin "lang=es": algunas instancias Photon rechazan los idiomas no indexados con HTTP 400.
  const url='https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:'7'});
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!response.ok)throw new Error('Photon no disponible ('+response.status+')');
  const data:PhotonResponse=await response.json();
  return (data.features||[]).flatMap(feature=>{
    const coords=feature.geometry?.coordinates,p=feature.properties;
    if(!p||!coords||coords.length<2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1]))return [];
    const label=formatPlace(p);
    return label?[{label,longitude:coords[0],latitude:coords[1],id:`osm:${p.osm_type||'place'}:${p.osm_id||label}`}]:[];
  });
}
async function cityFallback(query:string):Promise<LocationChoice[]> {
  // El servicio alternativo ofrece ciudades/localidades, no un catálogo exhaustivo de comercios.
  const url='https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({
    name:query,count:'7',language:'es',format:'json'
  });
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!response.ok)throw new Error('Servicio alternativo no disponible ('+response.status+')');
  const data:OpenMeteoResponse=await response.json();
  return (data.results||[]).flatMap(place=>{
    if(!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))return [];
    const label=[...new Set([place.name,place.admin1,place.country].filter(Boolean))].join(', ');
    return [{id:'geonames:'+place.id,label,latitude:place.latitude,longitude:place.longitude}];
  });
}
export function LocationSearch({value,onSelect,placeholder='Buscar una ciudad, calle o lugar…'}:{
  value?:string;onSelect:(choice:LocationChoice)=>void;placeholder?:string;
}){
  const [query,setQuery]=useState(value||'');
  const [results,setResults]=useState<LocationChoice[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [provider,setProvider]=useState<'photon'|'open-meteo'|null>(null);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{
    const changed=()=>setOnline(navigator.onLine);
    window.addEventListener('online',changed);window.addEventListener('offline',changed);
    return ()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};
  },[]);
  useEffect(()=>setQuery(value||''),[value]);

  async function lookup(){
    if(!online){setMessage('La búsqueda necesita conexión a Internet.');return;}
    const text=query.trim();
    if(text.length<3){setMessage('Escribe al menos tres caracteres.');return;}
    setLoading(true);setMessage('');setResults([]);setProvider(null);
    const key=text.toLocaleLowerCase('es');
    try{
      const saved=cache.get(key);
      if(saved){setResults(saved.places);setProvider(saved.provider);return;}
      let places:LocationChoice[]=[];
      let source:'photon'|'open-meteo'='photon';
      try {
        places=await photonSearch(text);
      }catch{
        // Los errores 400/403/429/503, falta de CORS y problemas de red no bloquean la interfaz.
      }
      if(!places.length){
        source='open-meteo';
        places=await cityFallback(text);
      }
      if(cache.size>=50)cache.delete(cache.keys().next().value!);
      cache.set(key,{places,provider:source});
      setResults(places);
      setProvider(source);
      if(!places.length)setMessage('No encontramos resultados. Prueba buscando una ciudad o localidad.');
    }catch{
      setMessage('Los proveedores de lugares no responden. Prueba de nuevo más tarde.');
    }finally{setLoading(false);}
  }
  return <div className="memrly-online-place-search">
    <div className="memrly-place-query">
      <Search size={17}/>
      <input aria-label="Buscar localización" value={query} maxLength={160}
        placeholder={placeholder} onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void lookup();}}}
        disabled={!online}/>
      <button type="button" onClick={()=>void lookup()}
        disabled={!online||loading||query.trim().length<3}>{loading?'Buscando…':'Buscar'}</button>
    </div>
    {!online&&<p className="memrly-place-note" role="status">Sin conexión. Los lugares ya guardados siguen disponibles.</p>}
    {message&&<p className="memrly-place-note" role="status">{message}</p>}
    {!!results.length&&<div className="memrly-place-results" role="listbox" aria-label="Resultados de lugares">
      {results.map((place,i)=><button type="button" role="option" aria-selected={false}
        key={place.id+':'+i} onClick={()=>{onSelect(place);setQuery(place.label);setResults([]);setMessage('');}}>
        <MapPin size={17}/><span>{place.label}</span><small>Elegir</small>
      </button>)}
    </div>}
    {provider==='open-meteo'&&<small className="memrly-place-credit">Búsqueda alternativa activa: muestra ciudades y localidades. Para calles y puntos de interés es necesario que Photon esté disponible.</small>}
    <small className="memrly-place-credit">Búsqueda online: Photon (datos OpenStreetMap); alternativa Open-Meteo (datos GeoNames). Se guardan solo el nombre y las coordenadas del lugar seleccionado.</small>
  </div>;
}
