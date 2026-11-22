import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarSegments } from '../src/calendarSegments.ts';

test('Viaje de Cantabria 9-14 agosto 2026: dos semanas, sin cambiar el número de celdas',()=>{
  const ranges=calendarSegments('2026-08-09','2026-08-14',2026,7);
  assert.deepEqual(ranges,[
    {week:1,startColumn:6,endColumn:6},
    {week:2,startColumn:0,endColumn:4}
  ]);
});
test('Viaje que abarca el mes: recorta al límite visible de semanas',()=>{
  const ranges=calendarSegments('2025-12-25','2026-01-11',2026,0);
  assert.deepEqual(ranges,[
    {week:0,startColumn:0,endColumn:6},
    {week:1,startColumn:0,endColumn:6}
  ]);
});
test('Rangos fuera del periodo o inválidos no crean contornos',()=>{
  assert.deepEqual(calendarSegments('2026-03-01','2026-03-02',2026,7),[]);
  assert.deepEqual(calendarSegments('2026-08-12','2026-08-09',2026,7),[]);
});
