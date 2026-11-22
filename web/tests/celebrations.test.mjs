import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticCelebrationIds,photoCelebrations,celebrationSeasons,hasCelebration,overrideCelebration} from '../src/celebrations.ts';
const settings={id:'main',relationshipStartedOn:'2022-08-14',myName:'Yo',myBirthday:'2000-05-01',partnerName:'Pareja',partnerBirthday:'2000-02-29',importantBirthdays:[],showTraditions:true};
const photo=(date)=>({id:'p'+date,takenOn:date,memoryIds:['trip','moment'],subjectIds:[]});
test('Navidades 24 diciembre - 6 enero, temporadas separadas',()=>{
 assert.deepEqual(automaticCelebrationIds('2025-12-25',settings).slice(0,2),['navidades','navidad']);
 assert.ok(automaticCelebrationIds('2026-01-06',settings).includes('reyes'));
 assert.ok(!automaticCelebrationIds('2026-01-07',settings).includes('navidades'));
 const s=celebrationSeasons([photo('2025-12-25'),photo('2026-01-06'),photo('2026-12-24')],settings,'navidades');
 assert.deepEqual(s.map(x=>[x.year,x.count]),[[2026,1],[2025,2]]);
 assert.equal(s[1].label,'Navidades 2025–2026');
});
test('Semana Santa y Carnaval son móviles',()=>{
 assert.ok(automaticCelebrationIds('2026-02-15',settings).includes('carnaval'));
 assert.ok(automaticCelebrationIds('2026-04-05',settings).includes('semana-santa'));
 assert.ok(automaticCelebrationIds('2027-03-28',settings).includes('semana-santa'));
});
test('Cumpleaños y aniversario',()=>{
 assert.ok(automaticCelebrationIds('2026-08-14',settings).includes('anniversary:relationship'));
 assert.ok(automaticCelebrationIds('2026-05-01',settings).includes('birthday:me'));
 assert.ok(automaticCelebrationIds('2027-02-28',settings).includes('birthday:partner'));
});
test('Asociaciones manuales no modifican viajes ni duplican fotos',()=>{
 const a=photo('2025-12-25'),b=overrideCelebration(a,'navidad','exclude');
 assert.equal(hasCelebration(b,settings,'navidad'),false);
 assert.equal(hasCelebration(b,settings,'navidades',2025),true);
 assert.deepEqual(b.memoryIds,['trip','moment']);
 const p=overrideCelebration(photo('2025-12-20'),'navidades','include');
 assert.equal(photoCelebrations(p,settings).find(c=>c.id==='navidades')?.source,'manual');
 assert.equal(hasCelebration(overrideCelebration(p,'navidades','auto'),settings,'navidades'),false);
});
