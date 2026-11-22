import { useEffect, useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { getPhotoAsset } from '../db';
import type { CoverPosition } from '../types';

export function PhotoView({id,quality='thumb',className='',children,onClick,focalPoint}:{
  id:string;quality?:'thumb'|'preview'|'original';className?:string;children?:ReactNode;onClick?:()=>void;focalPoint?:CoverPosition;
}){
  const [url,setUrl]=useState('');
  const [missing,setMissing]=useState(false);
  useEffect(()=>{
    let alive=true;let objectUrl='';
    setUrl('');setMissing(false);
    getPhotoAsset(id,quality).then(blob=>{
      if(!alive)return;
      if(!blob){setMissing(true);return;}
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(()=>{if(alive)setMissing(true);});
    return ()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[id,quality]);
  const content=<>{url?<img src={url} loading="lazy" alt="Recuerdo fotográfico" style={focalPoint?{objectPosition:`${Math.min(100,Math.max(0,focalPoint.x))}% ${Math.min(100,Math.max(0,focalPoint.y))}%`}:undefined}/>:<div className="photo-fallback"><ImageOff size={20}/>{missing?'Sin imagen':'Cargando...'}</div>}{children}</>;
  return onClick?<button type="button" className={'photo-view '+className} onClick={onClick}>{content}</button>:<div className={'photo-view '+className}>{content}</div>;
}
