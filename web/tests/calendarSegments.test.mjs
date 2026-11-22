import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarSegments, isSingleDayMemory } from '../src/calendarSegments.ts';

test('Viaje que cruza domingo: un tramo por semana, sin bordes interiores',()=>{
  const ranges=calendarSegments('2026-08-09','2026-08-14',2026,7);
  assert.deepEqual(ranges,[
    {week:1,startColumn:6,endColumn:6},
    {week:2,startColumn:0,endColumn:4}
  ]);
});
test('Recuerdo lunes a viernes: un único contorno exterior de cinco columnas',()=>{
  assert.deepEqual(calendarSegments('2026-08-10','2026-08-14',2026,7),[
    {week:2,startColumn:0,endColumn:4}
  ]);
});
test('Al cruzar de mes, se dibujan solo sus días visibles',()=>{
  assert.deepEqual(calendarSegments('2025-12-25','2026-01-11',2026,0),[
    {week:0,startColumn:3,endColumn:6},
    {week:1,startColumn:0,endColumn:6}
  ]);
  assert.deepEqual(calendarSegments('2026-07-30','2026-08-04',2026,7),[
    {week:0,startColumn:5,endColumn:6},
    {week:1,startColumn:0,endColumn:1}
  ]);
});
test('Evento de un solo día: un marco de una celda',()=>{
  assert.deepEqual(calendarSegments('2026-08-31','2026-08-31',2026,7),[
    {week:5,startColumn:0,endColumn:0}
  ]);
});
test('Fechas inválidas o fuera del mes: ningún marco',()=>{
  assert.deepEqual(calendarSegments('2026-03-01','2026-03-02',2026,7),[]);
  assert.deepEqual(calendarSegments('2026-08-12','2026-08-09',2026,7),[]);
});

test('Viaje de la captura 10 a 15 de agosto: un solo rectángulo de 6 columnas',()=>{
  assert.deepEqual(calendarSegments('2026-08-10','2026-08-15',2026,7),[
    {week:2,startColumn:0,endColumn:5}
  ]);
});

test('Solo un recuerdo de un día usa icono; uno de varios días dividido por semanas mantiene etiqueta',()=>{
  assert.equal(isSingleDayMemory('2026-08-04','2026-08-04'),true);
  assert.equal(isSingleDayMemory('2026-08-10','2026-08-11'),false);
  assert.equal(isSingleDayMemory('2026-08-09','2026-08-14'),false);
  assert.equal(isSingleDayMemory('',''),false);
  const segments=calendarSegments('2026-08-09','2026-08-14',2026,7);
  assert.equal(segments[0].startColumn,segments[0].endColumn);
  assert.equal(isSingleDayMemory('2026-08-09','2026-08-14'),false);
});
