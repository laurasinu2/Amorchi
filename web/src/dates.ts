export function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, offset: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset, 12);
  return localISO(date);
}

export function dateLabel(iso: string, style: 'long' | 'short' = 'long'): string {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', {
    weekday: style === 'long' ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(y, m - 1, d, 12));
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

export function startOfWeek(iso: string): string {
  const [y,m,d] = iso.split('-').map(Number);
  const date = new Date(y,m-1,d,12);
  const weekday = (date.getDay()+6)%7;
  return addDays(iso,-weekday);
}

export function monthWeeks(year:number, month:number): string[][] {
  const start = startOfWeek(localISO(new Date(year,month,1,12)));
  const end = localISO(new Date(year,month+1,0,12));
  const weeks:string[][] = [];
  for(let i=0;i<6;i++){
    const week=Array.from({length:7},(_,j)=>addDays(start,i*7+j));
    weeks.push(week);
    if(week[6]>=end)break;
  }
  return weeks;
}

export function covers(start:string,end:string,day:string):boolean {
  return start<=day && day<=end;
}

export function kindName(kind:string):string {
  return ({trip:'Viaje',event:'Evento',moment:'Momento'} as Record<string,string>)[kind] || kind;
}
