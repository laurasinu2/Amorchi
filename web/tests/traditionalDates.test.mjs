import test from 'node:test';
import assert from 'node:assert/strict';
import {easterSunday,holidaysOn,traditionalDays} from '../src/traditionalDates.ts';

test('Domingo de Pascua, Carnaval y Semana Santa cambian correctamente por año',()=>{
  assert.equal(easterSunday(2026),'2026-04-05');
  assert.equal(easterSunday(2027),'2027-03-28');
  assert.equal(holidaysOn('2027-02-07').some(x=>x.id==='carnaval'),true);
  assert.equal(holidaysOn('2027-03-26').some(x=>x.id==='good-friday'),true);
  assert.equal(holidaysOn('2027-03-29').some(x=>x.id==='easter-monday'),true);
});
test('celebraciones fijas incluyen Reyes, Sant Esteve, Navidad y Halloween',()=>{
  assert.equal(holidaysOn('2027-01-06').some(x=>x.id==='reyes'),true);
  assert.equal(holidaysOn('2027-12-26').some(x=>x.id==='sant-esteve'),true);
  assert.equal(holidaysOn('2027-12-25').some(x=>x.id==='christmas'),true);
  assert.equal(holidaysOn('2027-10-31').some(x=>x.id==='halloween'),true);
});
test('El 7 de diciembre no se presenta como festivo laboral',()=>{
  const day=holidaysOn('2027-12-07').find(x=>x.id==='december-bridge');
  assert.equal(day?.status,'optional-bridge');
  assert.equal(holidaysOn('2026-12-06').some(x=>x.id==='constitution'),true);
  assert.equal(traditionalDays(2027).filter(x=>x.id==='december-bridge').length,1);
});
test('Orden cronológico y sin filas duplicadas',()=>{
  const items=traditionalDays(2027);
  assert.deepEqual([...items].sort((a,b)=>a.date.localeCompare(b.date)),items);
  assert.equal(new Set(items.map(x=>x.id)).size,items.length);
});

test('Santos Inocentes, día tradicional de las bromas, se marca el 28 de diciembre cada año',()=>{
  for(const year of [2025,2026,2027,2030]){
    const day=holidaysOn(`${year}-12-28`).find(x=>x.id==='sants-innocents');
    assert.equal(day?.theme,'pranks');
    assert.equal(day?.status,'tradition');
    assert.match(day?.title||'',/Santos Inocentes/);
    assert.equal(holidaysOn(`${year}-12-27`).some(x=>x.id==='sants-innocents'),false);
  }
});
