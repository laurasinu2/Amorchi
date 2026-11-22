import type { AppSettings, Memory, Photo } from '../types';
import { covers, dateLabel, monthWeeks } from '../dates';
import { PhotoView } from './PhotoView';
import { occasionsOn } from '../specialDates';
import { holidaysOn } from '../traditionalDates';
import { calendarSegments } from '../calendarSegments';

const weekdays=['L','M','X','J','V','S','D'];
const category=(m:Memory)=>m.kind==='trip'?'Viaje':m.kind==='event'?'Evento':'Recuerdo';

/**
 * Rangos de varios días dibujados como una sola caja continua por semana.
 * Si cruzan al lunes siguiente, se conectan visualmente mediante otra caja.
 * Los números de los días incluidos llevan su propio resaltado.
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
      const spans=memories.filter(m=>m.startDate<=week[6]&&m.endDate>=week[0])
        .sort((a,b)=>a.kind===b.kind?a.startDate.localeCompare(b.startDate):a.kind==='trip'?-1:b.kind==='trip'?1:a.kind==='event'?-1:1)
        .slice(0,compact?1:3);
      return <div className="calendar-week" key={index}>
        {week.map(day=>{
          const current=Number(day.slice(5,7))===month+1;
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
              matches.length?'has-event memrly-in-range':'',selectedDay===day?'selected':'',
              holiday?'holiday-border holiday-'+holiday.theme:'',
              anniversary?'has-anniversary':''
            ].join(' ')} title={label} aria-label={label} onClick={()=>onDay(day)}>
            {photo&&<PhotoView id={photo.id} className="day-backdrop"/>}
            <span className={'day-number '+(matches.length?'memrly-number-mark':'')}>{Number(day.slice(8,10))}</span>
            {anniversary&&<span className="calendar-anniversary" aria-hidden="true"><span className="anniversary-heart">♥</span><span className="anniversary-count">{anniversary.years===0?'Inicio':`${anniversary.years}º`}</span></span>}
            {birthday&&<span className="calendar-birthday" aria-hidden="true">🎂</span>}
            {holiday&&<span className={'holiday-symbol holiday-symbol-'+holiday.theme} aria-hidden="true">{holiday.theme==='christmas'?'✶':holiday.theme==='carnival'?'🎭':holiday.theme==='pranks'?'🤭':holiday.theme==='autumn'?'🍂':holiday.theme==='spring'?'✿':holiday.theme==='bridge'?'↔':holiday.theme==='summer'?'☀':'★'}</span>}
          </button>;
        })}
        {/* Las franjas están fuera del flujo de las 7 celdas: no generan filas implícitas. */}
        {spans.length>0&&<div className="memrly-week-ranges" aria-hidden="true">
          {spans.map((m,i)=>{
            const segment=calendarSegments(m.startDate,m.endDate,year,month).find(s=>s.week===index);
            if(!segment)return null;
            const begin=segment.startColumn;
            const finish=segment.endColumn;
            return <div key={m.id} className={'memrly-range memrly-range-'+m.kind} style={{
              gridColumn:`${begin+1} / span ${finish-begin+1}`,
              gridRow:1,
              margin:`${2+i*4}px`,
              zIndex:3+i
            }} title={category(m)+': '+m.title}>
              <span className="memrly-range-label">{category(m)}: {m.title}</span>
            </div>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}
