import type { Memory } from '../types';

const land=[
  // Siluetas geográficas esquemáticas, para consulta offline. No es un mapa de navegación.
  'M50 122 L90 72 158 49 212 62 248 99 235 125 196 130 186 161 164 184 152 215 122 209 99 174 68 158 Z',
  'M168 229 L205 234 233 277 249 314 239 353 214 409 191 435 176 386 178 349 153 317 153 269 Z',
  'M390 98 L426 76 469 84 483 111 468 126 452 147 435 160 429 183 413 174 401 147 Z',
  'M414 172 L469 158 515 175 540 216 532 273 506 308 492 354 453 365 432 320 419 281 401 239 Z',
  'M479 95 L543 63 621 51 699 65 759 86 797 113 851 145 839 179 806 185 768 168 725 200 682 211 635 182 589 176 557 196 523 170 501 131 Z',
  'M755 292 L800 267 849 291 868 338 851 371 810 380 774 349 Z',
  'M352 49 L374 29 400 43 397 72 369 80 Z',
  'M942 405 L971 398 982 414 958 422 Z'
];
export function WorldMap({memories,onSelect}:{
  memories:Memory[];onSelect:(id:string)=>void;
}){
  const pinned=memories.filter(m=>Number.isFinite(m.latitude)&&Number.isFinite(m.longitude));
  return <div className="world-map">
    <svg viewBox="0 0 1000 490" role="img" aria-label="Mapa esquemático mundial con marcadores de recuerdos">
      <rect width="1000" height="490" rx="24" fill="#dbe9ed"/>
      <g fill="#a6baa7" stroke="#f8f1e8" strokeWidth="2.5">{land.map((path,i)=><path d={path} key={i}/>)}</g>
      <g stroke="#ffffff" strokeOpacity=".25" fill="none">
        <path d="M0 160H1000M0 325H1000M250 0V490M500 0V490M750 0V490" strokeDasharray="5 9"/>
      </g>
      {pinned.map(m=>{
        const x=(m.longitude!+180)/360*1000;
        const y=(90-m.latitude!)/180*490;
        return <g key={m.id} transform={`translate(${x} ${y})`} tabIndex={0} role="button" aria-label={m.title} onClick={()=>onSelect(m.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(m.id);}}} className="map-marker">
          <circle r="18" fill={m.kind==='trip'?'#b85c3b':m.kind==='event'?'#607d67':'#956885'} stroke="white" strokeWidth="4"/>
          <text textAnchor="middle" dy="5" fontSize="17" fill="white">{m.kind==='trip'?'✈':m.kind==='event'?'✦':'♥'}</text>
          <text y="-27" textAnchor="middle" fontSize="18" fontWeight="700" fill="#253343" stroke="#f8f1e8" strokeWidth="4" paintOrder="stroke">{m.title.slice(0,22)}</text>
        </g>;
      })}
    </svg>
    <div className="map-legend"><span>✈ Viajes</span><span>✦ Eventos</span><span>♥ Momentos</span></div>
    <small>Mapa esquemático disponible sin conexión. Solo se muestran recuerdos con coordenadas; no se representan fotografías individuales.</small>
  </div>;
}
