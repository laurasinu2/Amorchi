import {addDays} from './dates.ts';
import {easterSunday} from './traditionalDates.ts';
import {occursOn} from './specialDates.ts';
import type {AppSettings,Photo} from './types.ts';

export interface Celebration {id:string;title:string;description:string;recurring:true;seasonal?:boolean}
export interface CelebrationMatch {id:string;title:string;seasonYear:number;seasonLabel:string;source:'automatic'|'manual'}
const fixed:Celebration[]=[
{id:'navidades',title:'Navidades',description:'24 diciembre – 6 enero',recurring:true,seasonal:true},
{id:'nochebuena',title:'Nochebuena',description:'24 diciembre',recurring:true},
{id:'navidad',title:'Navidad',description:'25 diciembre',recurring:true},
{id:'sant-esteve',title:'Sant Esteve',description:'26 diciembre',recurring:true},
{id:'inocentes',title:'Santos Inocentes',description:'28 diciembre',recurring:true},
{id:'fin-ano',title:'Fin de Año',description:'31 diciembre',recurring:true},
{id:'ano-nuevo',title:'Año Nuevo',description:'1 enero',recurring:true},
{id:'reyes',title:'Reyes',description:'6 enero',recurring:true},
{id:'carnaval',title:'Carnaval',description:'Dijous Gras – Miércoles de Ceniza',recurring:true,seasonal:true},
{id:'semana-santa',title:'Semana Santa',description:'Domingo de Ramos – Lunes de Pascua',recurring:true,seasonal:true},
{id:'pascua',title:'Pascua',description:'Domingo de Pascua',recurring:true},
{id:'halloween',title:'Halloween y Castanyada',description:'31 octubre',recurring:true},
{id:'todos-santos',title:'Todos los Santos',description:'1 noviembre',recurring:true},
{id:'puente-diciembre',title:'Puente de diciembre',description:'6–8 diciembre (posible puente)',recurring:true,seasonal:true},
{id:'sant-jordi',title:'Sant Jordi',description:'23 abril',recurring:true},
{id:'sant-joan',title:'Sant Joan',description:'24 junio',recurring:true},
{id:'diada',title:'Diada de Catalunya',description:'11 septiembre',recurring:true}
];
export function celebrationCatalog(settings:AppSettings):Celebration[]{
 const out=[...fixed];
 if(settings.relationshipStartedOn)out.push({id:'anniversary:relationship',title:'Aniversario de pareja',description:'Fecha de la relación',recurring:true});
 for(const p of [
 {id:'me',name:settings.myName,date:settings.myBirthday},
 {id:'partner',name:settings.partnerName,date:settings.partnerBirthday},
 ...settings.importantBirthdays.map(x=>({id:x.id,name:x.name,date:x.date}))
 ])if(p.date)out.push({id:'birthday:'+p.id,title:'Cumpleaños de '+(p.name||'persona'),description:'Cada año',recurring:true});
 return out;
}
function valid(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const [y,m,d]=date.split('-').map(Number),p=new Date(y,m-1,d,12);
 return p.getFullYear()===y&&p.getMonth()+1===m&&p.getDate()===d;
}
export function automaticCelebrationIds(date:string,settings:AppSettings):string[]{
 if(!valid(date))return [];
 const year=Number(date.slice(0,4)),md=date.slice(5),ids:string[]=[];
 if(md>='12-24'||md<='01-06')ids.push('navidades');
 const one:Record<string,string>={'12-24':'nochebuena','12-25':'navidad','12-26':'sant-esteve','12-28':'inocentes','12-31':'fin-ano','01-01':'ano-nuevo','01-06':'reyes','10-31':'halloween','11-01':'todos-santos','04-23':'sant-jordi','06-24':'sant-joan','09-11':'diada'};
 if(one[md])ids.push(one[md]);
 if(md>='12-06'&&md<='12-08')ids.push('puente-diciembre');
 if(year>=1583&&year<=4099){
   const easter=easterSunday(year);
   if(date>=addDays(easter,-52)&&date<=addDays(easter,-46))ids.push('carnaval');
   if(date>=addDays(easter,-7)&&date<=addDays(easter,1))ids.push('semana-santa');
   if(date===easter)ids.push('pascua');
 }
 if(settings.relationshipStartedOn&&occursOn(settings.relationshipStartedOn,date))ids.push('anniversary:relationship');
 for(const p of [{id:'me',date:settings.myBirthday},{id:'partner',date:settings.partnerBirthday},...settings.importantBirthdays.map(x=>({id:x.id,date:x.date}))])
 if(p.date&&occursOn(p.date,date))ids.push('birthday:'+p.id);
 return ids;
}
function period(id:string,date:string){const year=Number(date.slice(0,4));return id==='navidades'&&date.slice(5)<='01-15'?year-1:year;}
export function photoCelebrations(photo:Photo,settings:AppSettings):CelebrationMatch[]{
 const choices=new Map(celebrationCatalog(settings).map(x=>[x.id,x]));
 const include=new Set(photo.celebrationIncludeIds||[]),exclude=new Set(photo.celebrationExcludeIds||[]);
 const result:CelebrationMatch[]=[];
 for(const id of new Set([...automaticCelebrationIds(photo.takenOn,settings),...include])){
   const item=choices.get(id);
   if(!item||exclude.has(id))continue;
   const year=period(id,photo.takenOn);
   result.push({id,title:item.title,seasonYear:year,seasonLabel:item.id==='navidades'?'Navidades '+year+'–'+(year+1):item.title+' '+year,source:include.has(id)?'manual':'automatic'});
 }
 return result;
}
export function hasCelebration(photo:Photo,settings:AppSettings,id:string,year?:number){return photoCelebrations(photo,settings).some(x=>x.id===id&&(year===undefined||year===x.seasonYear));}
export function celebrationSeasons(photos:Photo[],settings:AppSettings,id:string){
 const index=new Map<number,{year:number;label:string;count:number}>();
 for(const photo of photos){
  const match=photoCelebrations(photo,settings).find(x=>x.id===id);
  if(!match)continue;
  const item=index.get(match.seasonYear)||{year:match.seasonYear,label:match.seasonLabel,count:0};
  item.count++;index.set(match.seasonYear,item);
 }
 return [...index.values()].sort((a,b)=>b.year-a.year);
}
export function overrideCelebration(photo:Photo,id:string,action:'auto'|'include'|'exclude'):Photo{
 const include=new Set(photo.celebrationIncludeIds||[]),exclude=new Set(photo.celebrationExcludeIds||[]);
 include.delete(id);exclude.delete(id);
 if(action==='include')include.add(id);
 if(action==='exclude')exclude.add(id);
 return {...photo,celebrationIncludeIds:[...include],celebrationExcludeIds:[...exclude]};
}
