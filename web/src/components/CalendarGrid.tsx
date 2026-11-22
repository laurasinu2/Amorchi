import { CalendarDays, Heart, Plane } from 'lucide-react';
import type { AppSettings, Memory, Photo } from '../types';
import { covers, dateLabel, monthWeeks } from '../dates';
import { PhotoView } from './PhotoView';
import { occasionsOn } from '../specialDates';
import { holidaysOn } from '../traditionalDates';
import { calendarSegments, isSingleDayMemory } from '../calendarSegments';

const weekdays=['L','M','X','J','V','S','D'];
const category=(m:Memory)=>m.kind==='trip'?'Viaje':m.kind==='event'?'Evento':'Recuerdo';

/**
 * El contorno de un recuerdo es UNA caja por semana, calculada con las mismas
 * columnas y gap del grid real. No hay bordes individuales ni puentes por casilla.
 * La selección de un día tiene una capa superior e independiente.
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
      return <div className="calendar-week" key={index}>
        {week.map(day=>{
          const current=Number(day.slice(5,7))===month+1;
          const column=week.indexOf(day);
          const inRange=spans.some(({segment})=>column>=segment.startColumn&&column<=segment.endColumn);
          const photo=coverByDate.get(day);
          const matches=memories.filter(m=>covers(m.startDate,m.endDate,day));
          const specials=occasionsOn(day,settings);
          const anniversary=specials.find(s=>s.type==='anniversary');
          const birthday=specials.some(s=>s.type==='birthday');
          const holidays=settings.showTraditions===false?[]:holidaysOn(day);
          const holiday=holidays.find(h=>h.status!=='optional-bridge')||holidays[0];
          // Los recuerdos de una sola fecha se representan con un icono, nunca
          // mediante un tooltip de título; aria-label conserva el contexto completo.
          const label=[dateLabel(day),...matches.map(m=>category(m)+': '+m.title),...specials.map(s=>s.label),...holidays.map(h=>h.title)].join(' · ');
          const tooltip=[dateLabel(day),...matches.filter(m=>!isSingleDayMemory(m.startDate,m.endDate)).map(m=>category(m)+': '+m.title),...specials.map(s=>s.label),...holidays.map(h=>h.title)].join(' · ');
          return <button type="button" key={day} className={[
              'calendar-day',current?'':'muted',photo?'with-photo':'',
              matches.length?'has-event':'',
              inRange?'memrly-in-range':'',
              selectedDay===day?'selected':'',
              holiday?'holiday-border holiday-'+holiday.theme:'',
              birthday?'memrly-special-birthday':'',
              anniversary?'has-anniversary memrly-special-anniversary':''
            ].join(' ')} title={tooltip} aria-label={label} onClick={()=>onDay(day)}>
            {photo&&<PhotoView id={photo.id} className="day-backdrop"/>}
            <span className={'day-number '+(matches.length?'memrly-number-mark':'')}>{Number(day.slice(8,10))}</span>
            {anniversary&&<span className="calendar-anniversary" aria-hidden="true"><span className="anniversary-heart">♥</span><span className="anniversary-count">{anniversary.years===0?'Inicio':`${anniversary.years}º`}</span></span>}
            {birthday&&<span className="calendar-birthday" aria-hidden="true">🎂</span>}
            {holiday&&<span className={'holiday-symbol holiday-symbol-'+holiday.theme} aria-hidden="true">{holiday.theme==='christmas'?'✶':holiday.theme==='carnival'?'🎭':holiday.theme==='pranks'?'🤭':holiday.theme==='autumn'?'🍂':holiday.theme==='spring'?'✿':holiday.theme==='bridge'?'↔':holiday.theme==='summer'?'☀':'★'}</span>}

          </button>;
        })}
        {/* Capa ABSOLUTA: una sola caja que abarca desde el primer al último
            día del tramo, incluidos sus huecos internos; sin afectar al grid. */}
        {spans.length>0&&<div className="memrly-interval-layer" aria-hidden="true">
          {spans.map(({memory,segment},i)=><div
            key={memory.id}
            className={'memrly-interval-outline memrly-interval-'+memory.kind}
            style={{
              gridColumn:`${segment.startColumn+1} / ${segment.endColumn+2}`,
              gridRow:1,
              margin:`${i*3}px`,
            }}
          >
            {isSingleDayMemory(memory.startDate,memory.endDate)
              ? <span className={'memrly-interval-icon memrly-interval-icon-'+memory.kind}
                  title={undefined}
                  style={{
                    right:`calc(3px + ${i*20}px)`,
                    ...(settings.showTraditions!==false&&holidaysOn(memory.startDate).length>0?{bottom:'26px'}:{}),
                  }}>
                  {memory.kind==='trip'?<Plane size={14}/>:memory.kind==='event'?<CalendarDays size={14}/>:<Heart size={14}/>}
                </span>
              : !compact&&<span className="memrly-interval-tag">{category(memory)}: {memory.title}</span>}
          </div>)}
        </div>}
      </div>;
    })}
  </div>;
}
