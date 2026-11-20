import test from 'node:test';
import assert from 'node:assert/strict';
import { occursOn, occasionsOn } from '../src/specialDates.ts';

const settings={id:'main',homeCoverPhotoId:undefined,relationshipStartedOn:'2022-08-14',
 myName:'Laura',myBirthday:'2000-10-21',partnerName:'Pareja',partnerBirthday:'2001-01-03',
 importantBirthdays:[{id:'a',name:'Abuela',date:'1950-05-09'}]};

test('Aniversario recurrente con número exacto de años, incluso al inicio',()=>{
  assert.deepEqual(occasionsOn('2022-08-14',settings).map(x=>x.years),[0]);
  assert.deepEqual(occasionsOn('2026-08-14',settings).map(x=>x.years),[4]);
  assert.equal(occasionsOn('2026-08-15',settings).length,0);
  assert.equal(occasionsOn('2021-08-14',settings).length,0);
});
test('Cumpleaños propios, de pareja e importantes cada año',()=>{
  assert.match(occasionsOn('2026-10-21',settings)[0].label,/Laura/);
  assert.match(occasionsOn('2026-01-03',settings)[0].label,/Pareja/);
  assert.match(occasionsOn('2026-05-09',settings)[0].label,/Abuela/);
});
test('29 de febrero se muestra el 28 de febrero en año no bisiesto',()=>{
  assert.equal(occursOn('2020-02-29','2024-02-29'),true);
  assert.equal(occursOn('2020-02-29','2025-02-28'),true);
  assert.equal(occursOn('2020-02-29','2025-03-01'),false);
});
