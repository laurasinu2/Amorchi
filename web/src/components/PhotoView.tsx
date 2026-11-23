import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { getOnlinePhotoBlob } from '../onlineLibrary';
import type { CoverPosition } from '../types';

export function PhotoView({id,quality='thumb',className='',children,onClick,focalPoint}:{
  id:string;quality?:'thumb'|'preview'|'original';className?:string;children?:ReactNode;onClick?:()=>void;focalPoint?:CoverPosition;
}){
  const host=useRef<HTMLElement|null>(null);
  const [visible,setVisible]=useState(false);
  const [url,setUrl]=useState('');
  useEffect(()=>{
    const element=host.current;
    if(!element)return;
    if(!('IntersectionObserver' in window)){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:'300px'});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const [missing,setMissing]=useState(false);
  useEffect(()=>{
    let alive=true;let objectUrl='';
    setUrl('');setMissing(false);
    if(!visible)return;
    getOnlinePhotoBlob(id,quality).then(blob=>{
      if(!alive)return;
      if(!blob){setMissing(true);return;}
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(()=>{if(alive)setMissing(true);});
    return ()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[id,quality,visible]);
  const content=<>{url?<img src={url} loading="lazy" alt="Recuerdo fotográfico" style={focalPoint?{objectPosition:`${Math.min(100,Math.max(0,focalPoint.x))}% ${Math.min(100,Math.max(0,focalPoint.y))}%`}:undefined}/>:<div className="photo-fallback"><ImageOff size={20}/>{missing?'Sin imagen':'Cargando...'}</div>}{children}</>;
  return onClick?<button ref={element=>{host.current=element;}} type="button" className={'photo-view '+className} onClick={onClick}>{content}</button>:<div ref={element=>{host.current=element;}} className={'photo-view '+className}>{content}</div>;
}
