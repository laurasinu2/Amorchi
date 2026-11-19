import type { AppSettings,Memory,Photo } from '../types';
import { covers, dateLabel, monthWeeks } from '../dates';
import { PhotoView } from './PhotoView';
import { occasionsOn } from '../specialDates';

const weekdays=['L','M','X','J','V','S','D'];
export function CalendarGrid({year,month,photos,memories,onDay,settings,compact=false,selectedDay}:{
  year:number;month:number;photos:Photo[];memories:Memory[];settings:AppSettings;onDay:(iso:string)=>void;compact?:boolean;selectedDay?:string;
}){
  const weeks=monthWeeks(year,month);
  const byDate=new Map<string,Photo>();
  for(const photo of photos){
    if(!byDate.has(photo.takenOn))byDate.set(photo.takenOn,photo);
  }
  return <div className={'calendar-grid '+(compact?'compact':'')}>
    <div className="week-names">{weekdays.map((d,i)=><span key={i}>{d}</span>)}</div>
    {weeks.map((week,index)=>{
      const overlaps=memories.filter(m=>m.startDate<=week[6]&&m.endDate>=week[0]).slice(0,2);
      return <div className="calendar-week" key={index}>
        {week.map(day=>{
          const current=Number(day.slice(5,7))===month+1;
          const photo=byDate.get(day);
          const matches=memories.filter(m=>covers(m.startDate,m.endDate,day));
          const specials=occasionsOn(day,settings);
          const anniversary=specials.find(s=>s.type==='anniversary');
          const birthdays=specials.filter(s=>s.type==='birthday');
          return <button key={day} type="button" title={[dateLabel(day),...specials.map(s=>s.label)].join(' · ')} aria-label={[dateLabel(day),...specials.map(s=>s.label)].join(' · ')} className={['calendar-day',current?'':'muted',photo?'with-photo':'',matches.length?'has-event':'',anniversary?'has-anniversary':'',selectedDay===day?'selected':''].join(' ')} onClick={()=>onDay(day)}>
            {photo&&<PhotoView id={photo.id} className="day-backdrop"/>}
            <span className="day-number">{Number(day.slice(8,10))}</span>
            {anniversary&&<span className="calendar-anniversary" aria-hidden="true"><span className="anniversary-heart">♥</span><span className="anniversary-count">{anniversary.years===0?'Inicio':`${anniversary.years}º`}</span></span>}
            {birthdays.length>0&&<span className="calendar-birthday" aria-hidden="true">🎂</span>}
            {!photo&&matches.length>0&&<span className="calendar-dot"/>}
          </button>;
        })}
        <div className="calendar-strips">
          {overlaps.map((m,i)=>{
            const begin=m.startDate<week[0]?0:week.indexOf(m.startDate);
            const finish=m.endDate>week[6]?6:week.indexOf(m.endDate);
            return <div key={m.id} className={'calendar-strip '+m.kind} style={{gridColumn:`${begin+1} / span ${finish-begin+1}`,gridRow:i+1}} title={m.title}>
              <span>{m.kind==='trip'?'✈ ':m.kind==='event'?'◷ ':'♡ '}{m.title}</span>
            </div>;
          })}
        </div>
      </div>;
    })}
  </div>;
}
