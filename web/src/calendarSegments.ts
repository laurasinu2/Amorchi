import { monthWeeks } from './dates';

/** Reproducible span calculation for a multi-day memory within each calendar week. */
export function calendarSegments(start:string,end:string,year:number,month:number):Array<{startColumn:number;endColumn:number;week:number}>{
  if(!start||!end||end<start)return [];
  return monthWeeks(year,month).flatMap((days,index)=>{
    if(start>days[6]||end<days[0])return [];
    const from=start<=days[0]?0:days.indexOf(start);
    const to=end>=days[6]?6:days.indexOf(end);
    return from<0||to<from?[]:[{startColumn:from,endColumn:to,week:index}];
  });
}
