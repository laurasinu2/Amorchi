import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { MapPin, WifiOff } from 'lucide-react';
import type { Memory, Photo } from '../types';
import type { LocationChoice } from './LocationSearch';
import './online-places.css';

const markerColors={trip:'#a65c46',event:'#527b65',moment:'#805b8e'} as const;

function FlyToLocation({location}:{location?:LocationChoice}){
  const map=useMap();
  useEffect(()=>{if(location)map.flyTo([location.latitude,location.longitude],11,{duration:.6});},
    [location?.latitude,location?.longitude,map]);
  return null;
}

export function WorldMap({memories,photos=[],onSelect,onSelectPhoto,focus}:{
  memories:Memory[];photos?:Photo[];onSelect:(id:string)=>void;onSelectPhoto?:(id:string)=>void;focus?:LocationChoice;
}){
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{
    const changed=()=>setOnline(navigator.onLine);
    window.addEventListener('online',changed);window.addEventListener('offline',changed);
    return ()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};
  },[]);
  const locatedMemories=memories.filter(m=>m.latitude!==undefined&&m.longitude!==undefined&&
    Number.isFinite(m.latitude)&&Number.isFinite(m.longitude));
  const locatedPhotos=photos.filter(p=>p.latitude!==undefined&&p.longitude!==undefined&&
    Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
  return <section className="world-map">
    <div className="world-map-tools"><div><strong>Mapa de nuestros recuerdos</strong>
      <small>Cartografía online · OpenStreetMap · no se descargan mapas</small></div></div>
    <div className="world-map-frame memrly-online-map-frame">
      {online
        ? <MapContainer center={[22,0]} zoom={2} minZoom={2} maxZoom={18} scrollWheelZoom
            zoomControl={false} className="leaflet-world-map">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
              crossOrigin={false}
            />
            {locatedMemories.map(m=><CircleMarker key={'m:'+m.id}
              center={[m.latitude!,m.longitude!]} radius={10}
              pathOptions={{color:'#ffffff',weight:2,fillColor:markerColors[m.kind],fillOpacity:.94}}
              eventHandlers={{click:()=>onSelect(m.id)}}>
              <Tooltip direction="top">{m.title} · {m.place}</Tooltip>
            </CircleMarker>)}
            {locatedPhotos.map(p=><CircleMarker key={'p:'+p.id} center={[p.latitude!,p.longitude!]}
              radius={5} pathOptions={{color:'#ffffff',weight:1,fillColor:'#366cb5',fillOpacity:.8}}
              eventHandlers={{click:()=>onSelectPhoto?.(p.id)}}>
              <Tooltip direction="top">{p.place||p.filename}</Tooltip>
            </CircleMarker>)}
            <FlyToLocation location={focus}/>
            <ZoomControl position="bottomright"/>
          </MapContainer>
        : <div className="memrly-world-offline"><WifiOff size={26}/><strong>El mapa necesita Internet</strong>
            <p>Los nombres y coordenadas ya guardados siguen disponibles en la lista.</p></div>}
    </div>
    <div className="map-legend"><span>🧳 Viajes</span><span>✦ Eventos</span><span>♥ Momentos</span><span>● Fotografías</span>
      <span><MapPin size={13}/>{locatedMemories.length} recuerdos · {locatedPhotos.length} fotos</span></div>
    <small>El mapa se carga desde OpenStreetMap al estar conectado. No guardamos cartografía en Memrly ni en Contabo. Los proveedores externos reciben las peticiones necesarias para mostrar el mapa.</small>
  </section>;
}
