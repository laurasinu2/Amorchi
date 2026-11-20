import {addDays, localISO} from './dates.ts';

export type HolidayTheme='christmas'|'spring'|'carnival'|'autumn'|'national'|'bridge'|'summer';
export type HolidayStatus='tradition'|'common-holiday'|'optional-bridge';
export interface TraditionalDay {
  id:string;
  date:string;
  title:string;
  theme:HolidayTheme;
  status:HolidayStatus;
  label?:string;
}
function iso(year:number,month:number,day:number){return localISO(new Date(year,month-1,day,12));}
function put(list:TraditionalDay[],id:string,date:string,title:string,theme:HolidayTheme,status:HolidayStatus='tradition'){
  list.push({id,date,title,theme,status});
}

/** Computus gregoriano, válido entre 1583 y 4099. */
export function easterSunday(year:number):string{
  if(!Number.isInteger(year)||year<1583||year>4099)throw new Error('Año fuera del rango del calendario gregoriano.');
  const a=year%19,b=Math.floor(year/100),c=year%100;
  const d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const n=h+l-7*m+114;
  return iso(year,Math.floor(n/31),n%31+1);
}

export function traditionalDays(year:number):TraditionalDay[]{
  if(year<1583||year>4099)return [];
  const all:TraditionalDay[]=[];
  const fixed=[
    ['new-year',1,1,'Año Nuevo','christmas','common-holiday'],
    ['reyes-eve',1,5,'Cabalgata de Reyes','christmas','tradition'],
    ['reyes',1,6,'Día de Reyes','christmas','common-holiday'],
    ['sant-jordi',4,23,'Sant Jordi','spring','tradition'],
    ['labour',5,1,'Día del Trabajo','national','common-holiday'],
    ['sant-joan-eve',6,23,'Verbena de Sant Joan','summer','tradition'],
    ['sant-joan',6,24,'Sant Joan','summer','common-holiday'],
    ['diada',9,11,'Diada de Catalunya','national','common-holiday'],
    ['hispanidad',10,12,'12 de octubre','national','common-holiday'],
    ['halloween',10,31,'Halloween y Castanyada','autumn','tradition'],
    ['all-saints',11,1,'Todos los Santos','autumn','common-holiday'],
    ['constitution',12,6,'Día de la Constitución','national','common-holiday'],
    ['purissima',12,8,'La Purísima · Inmaculada','christmas','common-holiday'],
    ['christmas-eve',12,24,'Nochebuena','christmas','tradition'],
    ['christmas',12,25,'Navidad','christmas','common-holiday'],
    ['sant-esteve',12,26,'Sant Esteve','christmas','tradition'],
    ['new-years-eve',12,31,'Fin de Año','christmas','tradition']
  ] as const;
  for(const [id,m,d,title,theme,status] of fixed)put(all,id,iso(year,m,d),title,theme,status);
  // No convertir automáticamente el 7 de diciembre en festivo laboral.
  const seventh=new Date(year,11,7,12).getDay();
  if(seventh!==0&&seventh!==6)put(all,'december-bridge',iso(year,12,7),'Posible puente de diciembre (día laborable)','bridge','optional-bridge');
  const easter=easterSunday(year);
  put(all,'palm-sunday',addDays(easter,-7),'Domingo de Ramos','spring');
  for(let i=-6;i<=-4;i++)put(all,'holy-week-'+i,addDays(easter,i),'Semana Santa','spring');
  put(all,'holy-thursday',addDays(easter,-3),'Jueves Santo','spring');
  put(all,'good-friday',addDays(easter,-2),'Viernes Santo','spring','common-holiday');
  put(all,'holy-saturday',addDays(easter,-1),'Sábado Santo','spring');
  put(all,'easter',easter,'Domingo de Pascua','spring');
  put(all,'easter-monday',addDays(easter,1),'Lunes de Pascua','spring','common-holiday');
  const carnavalStart=addDays(easter,-52);
  for(let i=0;i<=6;i++){
    const day=addDays(carnavalStart,i);
    if(i===0)put(all,'dijous-gras',day,'Dijous Gras · Inicio de Carnaval','carnival');
    else if(i===3)put(all,'carnaval',day,'Domingo de Carnaval','carnival');
    else if(i===6)put(all,'ash-wednesday',day,'Miércoles de Ceniza · Fin de Carnaval','carnival');
    else put(all,'carnaval-day-'+i,day,'Semana de Carnaval','carnival');
  }
  return all.sort((a,b)=>a.date.localeCompare(b.date));
}
const cache=new Map<number,TraditionalDay[]>();
export function holidaysOn(day:string):TraditionalDay[]{
  const year=Number(day.slice(0,4));
  if(!cache.has(year))cache.set(year,traditionalDays(year));
  return (cache.get(year)||[]).filter(x=>x.date===day);
}
export function holidaysInRange(start:string,end:string):TraditionalDay[]{
  const first=Number(start.slice(0,4)),last=Number(end.slice(0,4));
  const results:TraditionalDay[]=[];
  for(let year=first;year<=last;year++) {
    if(!cache.has(year))cache.set(year,traditionalDays(year));
    results.push(...(cache.get(year)||[]).filter(h=>h.date>=start&&h.date<=end));
  }
  return results;
}
