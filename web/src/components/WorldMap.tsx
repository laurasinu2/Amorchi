import { useEffect, useState, type ChangeEvent } from 'react';
import { ImageOverlay, MapContainer, CircleMarker, Tooltip, ZoomControl } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { ImagePlus, Map as MapIcon } from 'lucide-react';
import type { Memory } from '../types';
import { getWorldMapImage, saveWorldMapImage } from '../db';

/**
 * GeoTIFF original: EPSG:3857, 28740 x 27559 pixels.
 * Bounding box en metros:
 * xmin=-20075000, ymin=-19250000, xmax=20074860.299720608, ymax=19250000.
 *
 * La versión WebP deriva de dicho raster sin recortar, por lo que conserva
 * su georreferenciación mediante este bounding box externo.
 * Leaflet utiliza EPSG:3857, el mismo CRS que el GeoTIFF.
 */
const R=6378137;
const lng=(x:number)=>x/R*180/Math.PI;
const lat=(y:number)=>Math.atan(Math.sinh(y/R))*180/Math.PI;
export const WORLD_RASTER_BOUNDS:LatLngBoundsExpression=[
  [lat(-19250000),lng(-20075000)],
  [lat(19250000),lng(20074860.299720608)]
];
const markerColors={trip:'#b96848',event:'#70906b',moment:'#956788'} as const;

export function WorldMap({memories,onSelect}:{
  memories:Memory[];onSelect:(id:string)=>void;
}){
  const [url,setUrl]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [importing,setImporting]=useState(false);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let alive=true;
    let imageUrl='';
    setLoading(true);
    getWorldMapImage().then(blob=>{
      if(!alive)return;
      if(blob){imageUrl=URL.createObjectURL(blob);setUrl(imageUrl);}
      else setUrl('');
    }).catch(e=>{if(alive)setError(String(e));}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;if(imageUrl)URL.revokeObjectURL(imageUrl);};
  },[version]);
  async function onImport(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file)return;
    setError('');setImporting(true);
    try{await saveWorldMapImage(file);setVersion(x=>x+1);}
    catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setImporting(false);}
  }
  const pinned=memories.filter(m=>m.latitude!==undefined&&m.longitude!==undefined&&Number.isFinite(m.latitude)&&Number.isFinite(m.longitude));
  return <div className="world-map">
    <div className="world-map-tools">
      <div><strong>Mapa de nuestros recuerdos</strong><small>Mapa físico y político mundial georreferenciado · EPSG:3857</small></div>
      <label className="btn subtle world-upload">
        <ImagePlus size={16}/>{importing?'Importando…':url?'Sustituir mapa':'Cargar mapa optimizado'}
        <input type="file" accept="image/webp,image/png,image/jpeg,.webp" disabled={importing} onChange={onImport}/>
      </label>
    </div>
    <div className="world-map-frame">
      <MapContainer center={[18,0]} zoom={2} minZoom={1} maxZoom={7} worldCopyJump={false} scrollWheelZoom zoomControl={false} attributionControl={false} className="leaflet-world-map">
        {url&&<ImageOverlay url={url} bounds={WORLD_RASTER_BOUNDS} opacity={1}/>}
        {pinned.map(m=><CircleMarker key={m.id} center={[m.latitude!,m.longitude!]} radius={11} pathOptions={{color:'#fff7ef',weight:3,fillColor:markerColors[m.kind],fillOpacity:.95}} eventHandlers={{click:()=>onSelect(m.id)}}>
          <Tooltip direction="top">{m.kind==='trip'?'✈ ':m.kind==='event'?'✦ ':'♥ '}{m.title}</Tooltip>
        </CircleMarker>)}
        <ZoomControl position="bottomright"/>
      </MapContainer>
      {!url&&!loading&&<div className="world-map-empty"><MapIcon size={27}/><strong>Importa el mapa optimizado</strong><p>El GeoTIFF original pesa unos 480 MB. Utiliza el WebP optimizado generado a partir del mapa que has compartido. Se guardará en este dispositivo y funcionará sin conexión.</p></div>}
    </div>
    <div className="map-legend"><span>🧳 Viajes</span><span>✦ Eventos</span><span>♥ Momentos</span><span>{pinned.length} recuerdos localizados</span></div>
    {error&&<p className="form-errors" role="alert">{error}</p>}
    <small>Los marcadores representan recuerdos y viajes, no fotos individuales. La cartografía se almacena localmente y no necesita peticiones a mapas externos.</small>
  </div>;
}
