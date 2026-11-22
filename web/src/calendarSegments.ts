import { localISO, monthWeeks } from './dates.ts';

export interface CalendarSegment { startColumn:number; endColumn:number; week:number }

/**
 * Calcula un único tramo exterior por semana, sin separadores internos.
 * Recorta las fechas visibles al mes actual para no marcar días atenuados
 * del mes anterior o siguiente.
 */
export function calendarSegments(start:string,end:string,year:number,month:number):CalendarSegment[]{
  if(!start||!end||end<start)return [];
  const first=localISO(new Date(year,month,1,12));
  const last=localISO(new Date(year,month+1,0,12));
  const from=start>first?start:first;
  const to=end<last?end:last;
  if(from>to)return [];
  return monthWeeks(year,month).flatMap((days,index)=>{
    if(from>days[6]||to<days[0])return [];
    const left=from<=days[0]?0:days.indexOf(from);
    const right=to>=days[6]?6:days.indexOf(to);
    return left<0||right<left?[]:[{startColumn:left,endColumn:right,week:index}];
  });
}

/** Banderas de borde de la celda, calculadas sobre los segmentos semanales. */
export function calendarCellEdges(segments:CalendarSegment[],week:number,column:number){
  const segment=segments.find(s=>s.week===week&&s.startColumn<=column&&column<=s.endColumn);
  return {
    inRange:Boolean(segment),
    left:Boolean(segment&&segment.startColumn===column),
    right:Boolean(segment&&segment.endColumn===column),
    bridge:Boolean(segment&&column<segment.endColumn),
  };
}
