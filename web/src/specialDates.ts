import type { AppSettings } from './types';

export interface SpecialOccasion {
  id:string;
  type:'anniversary'|'birthday';
  label:string;
  years?:number;
}

// Las fechas son civiles, nunca UTC. El 29 de febrero se celebra el 28
// en años no bisiestos, para que los avisos aparezcan todos los años.
function isLeap(year:number){return year%4===0&&(year%100!==0||year%400===0);}

export function occursOn(anniversaryDate:string,day:string):boolean {
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(anniversaryDate)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(day))return false;
  const year=Number(day.slice(0,4));
  if(year<Number(anniversaryDate.slice(0,4)))return false;
  const mmdd=anniversaryDate.slice(5);
  const expected=mmdd==='02-29'&&!isLeap(year)?'02-28':mmdd;
  return day.slice(5)===expected;
}

export function occasionsOn(day:string,settings:AppSettings):SpecialOccasion[]{
  const results:SpecialOccasion[]=[];
  if(settings.relationshipStartedOn&&occursOn(settings.relationshipStartedOn,day)){
    const years=Number(day.slice(0,4))-Number(settings.relationshipStartedOn.slice(0,4));
    results.push({id:'relationship',type:'anniversary',years,label:years===0?'Inicio de nuestra relación':`${years} ${years===1?'año':'años'} juntos`});
  }
  for(const birthday of [
    {id:'me',name:settings.myName||'Mi cumpleaños',date:settings.myBirthday},
    {id:'partner',name:settings.partnerName||'Mi pareja',date:settings.partnerBirthday},
    ...settings.importantBirthdays.map(b=>({id:b.id,name:b.name,date:b.date}))
  ]){
    if(birthday.date&&occursOn(birthday.date,day)){
      const age=Number(day.slice(0,4))-Number(birthday.date.slice(0,4));
      results.push({id:birthday.id,type:'birthday',years:age,label:`Cumpleaños de ${birthday.name}${age>0?` · ${age} años`:''}`});
    }
  }
  return results;
}
