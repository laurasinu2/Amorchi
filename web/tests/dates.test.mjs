import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, covers, localISO, monthWeeks, startOfWeek } from '../src/dates.ts';

test('el calendario empieza el lunes y termina en el mes solicitado',()=>{
  assert.equal(startOfWeek('2025-07-01'),'2025-06-30');
  const weeks=monthWeeks(2025,6);
  assert.equal(weeks[0][0],'2025-06-30');
  assert.equal(weeks.at(-1)[6],'2025-08-03');
});
test('las fechas civiles sobreviven a un cambio de año',()=>{
  assert.equal(addDays('2025-12-31',1),'2026-01-01');
  assert.equal(addDays('2026-01-01',-1),'2025-12-31');
  assert.equal(localISO(new Date(2026,1,28,12)),'2026-02-28');
});
test('los eventos de varios días incluyen fechas de inicio y fin',()=>{
  assert.equal(covers('2025-07-10','2025-07-14','2025-07-10'),true);
  assert.equal(covers('2025-07-10','2025-07-14','2025-07-14'),true);
  assert.equal(covers('2025-07-10','2025-07-14','2025-07-15'),false);
});
