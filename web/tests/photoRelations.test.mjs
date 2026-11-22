import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedPhotos,relatedMemories } from '../src/photoRelations.ts';
const p=(id,date,memoryIds=[],takenTime='12:00')=>({id,takenOn:date,takenTime,memoryIds,createdAt:'2026-01-01'});
const m=(id,title,startDate,endDate)=>({id,title,startDate,endDate,kind:'trip'});
test('Una foto abre vecinas del mismo día o recuerdo sin duplicados',()=>{
 const current=p('a','2026-08-12',['trip-a','moment-a']);
 const all=[p('d','2026-08-13',['else']),p('c','2026-08-13',['trip-a']),p('b','2026-08-12',['else']),current,p('e','2026-08-11',['moment-a'])];
 assert.deepEqual(relatedPhotos(current,all).map(x=>x.id),['e','a','b','c']);
});
test('Relacionados: ordena vínculos explícitos antes que coincidencias por fecha',()=>{
 const current=p('a','2026-08-12',['trip-a']);
 const memories=[
  m('same-day','Cumpleaños','2026-08-12','2026-08-12'),
  m('else','No coincide','2026-07-01','2026-07-03'),
  m('trip-a','Viaje','2026-08-10','2026-08-15'),
  m('overlap','Escapada','2026-08-11','2026-08-12')
 ];
 assert.deepEqual(relatedMemories(current,memories).map(x=>x.id),['trip-a','same-day','overlap']);
});
test('Sin recuerdos asociados ni coincidencias: sin falsas relaciones',()=>{
 assert.deepEqual(relatedMemories(p('x','2025-01-01'),[m('y','Otro','2025-02-01','2025-02-02')]),[]);
});
