import type { AppSettings, Memory, Photo } from '../types';
import { covers, dateLabel, monthWeeks } from '../dates';
import { PhotoView } from './PhotoView';
import { occasionsOn } from '../specialDates';
import { holidaysOn } from '../traditionalDates';
import { calendarCellEdges, calendarSegments } from '../calendarSegments';

const weekdays=['L','M','X','J','V','S','D'];
const category=(m:Memory)=>m.kind==='trip'?'Viaje':m.kind==='event'?'Evento':'Recuerdo';

/**
 * Un tramo semanal comparte únicamente el contorno EXTERIOR de sus casillas.
 * Las casillas interiores no tienen bordes verticales. Esto mantiene el marco
 * perfectamente alineado con las fotografías y con el día seleccionado.
 */
export function CalendarGrid({year,month,photos,memories,onDay,settings,compact=false,selectedDay}:{
  year:number;month:number;photos:Photo[];memories:Memory[];settings:AppSettings;
  onDay:(iso:string)=>void;compact?:boolean;selectedDay?:string;
}){
  const weeks=monthWeeks(year,month);
  const coverByDate=new Map<string,Photo>();
  for(const p of [...photos].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))){
    if(!coverByDate.has(p.takenOn))coverByDate.set(p.takenOn,p);
  }
  return <div className={'calendar-grid memrly-calendar-grid '+(compact?'compact':'')}>
    <div className="week-names">{weekdays.map((name,i)=><span key={i}>{name}</span>)}</div>
    {weeks.map((week,index)=>{
      const spans=memories
        .filter(m=>m.startDate<=week[6]&&m.endDate>=week[0])
        .sort((a,b)=>a.kind===b.kind?a.startDate.localeCompare(b.startDate):a.kind==='trip'?-1:b.kind==='trip'?1:a.kind==='event'?-1:1)
        .map(memory=>({memory,segment:calendarSegments(memory.startDate,memory.endDate,year,month).find(part=>part.week===index)}))
        .filter((item):item is {memory:Memory;segment:{week:number;startColumn:number;endColumn:number}}=>Boolean(item.segment))
        .slice(0,compact?1:3);
      // Etiqueta breve al final del tramo visible de cada semana.
      const tagByDay=new Map<string,Memory>();
      if(!compact){
        const visible=week.filter(day=>Number(day.slice(5,7))===month+1);
        const firstVisible=visible[0],lastVisible=visible.at(-1);
        if(firstVisible&&lastVisible){
          for(const {memory:m} of spans){
            const finalDay=m.endDate<lastVisible?m.endDate:lastVisible;
            if(finalDay>=firstVisible&&!tagByDay.has(finalDay))tagByDay.set(finalDay,m);
          }
        }
      }
      return <div className="calendar-week" key={index}>
        {week.map(day=>{
          const current=Number(day.slice(5,7))===month+1;
          const column=week.indexOf(day);
          const edges=calendarCellEdges(spans.map(({segment})=>segment),index,column);
          const inRange=edges.inRange;
          const isRangeStart=edges.left;
          const isRangeEnd=edges.right;
          const photo=coverByDate.get(day);
          const matches=memories.filter(m=>covers(m.startDate,m.endDate,day));
          const specials=occasionsOn(day,settings);
          const anniversary=specials.find(s=>s.type==='anniversary');
          const birthday=specials.some(s=>s.type==='birthday');
          const holidays=settings.showTraditions===false?[]:holidaysOn(day);
          const holiday=holidays.find(h=>h.status!=='optional-bridge')||holidays[0];
          const label=[dateLabel(day),...matches.map(m=>category(m)+': '+m.title),...specials.map(s=>s.label),...holidays.map(h=>h.title)].join(' · ');
          return <button type="button" key={day} className={[
              'calendar-day',current?'':'muted',photo?'with-photo':'',
              matches.length?'has-event':'',
              inRange?'memrly-in-range':'',
              inRange&&isRangeStart?'memrly-range-first':'',
              inRange&&isRangeEnd?'memrly-range-last':'',
              inRange&&!isRangeEnd?'memrly-range-bridged':'',
              selectedDay===day?'selected':'',
              holiday?'holiday-border holiday-'+holiday.theme:'',
              anniversary?'has-anniversary':''
            ].join(' ')} title={label} aria-label={label} onClick={()=>onDay(day)}>
            {photo&&<PhotoView id={photo.id} className="day-backdrop"/>}
            <span className={'day-number '+(matches.length?'memrly-number-mark':'')}>{Number(day.slice(8,10))}</span>
            {anniversary&&<span className="calendar-anniversary" aria-hidden="true"><span className="anniversary-heart">♥</span><span className="anniversary-count">{anniversary.years===0?'Inicio':`${anniversary.years}º`}</span></span>}
            {birthday&&<span className="calendar-birthday" aria-hidden="true">🎂</span>}
            {holiday&&<span className={'holiday-symbol holiday-symbol-'+holiday.theme} aria-hidden="true">{holiday.theme==='christmas'?'✶':holiday.theme==='carnival'?'🎭':holiday.theme==='pranks'?'🤭':holiday.theme==='autumn'?'🍂':holiday.theme==='spring'?'✿':holiday.theme==='bridge'?'↔':holiday.theme==='summer'?'☀':'★'}</span>}
            {tagByDay.has(day)&&<span className="memrly-day-event-tag" aria-hidden="true">{category(tagByDay.get(day)!)}: {tagByDay.get(day)!.title}</span>}
            {inRange&&!isRangeEnd&&<span className="memrly-range-bridge" aria-hidden="true"/>}
          </button>;
        })}
      </div>;
    })}
  </div>;
}
