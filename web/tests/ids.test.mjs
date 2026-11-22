import test from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../src/id.ts';

test('UUID seguro usando getRandomValues aunque randomUUID no exista (HTTP LAN)',()=>{
  let next=0;
  const source={getRandomValues(array){for(let i=0;i<array.length;i++)array[i]=(next++*23+17)%256;return array;}};
  const id=createId(source);
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(createId(source),id);
});

test('usar randomUUID nativo cuando exista',()=>{
  const known='12345678-1234-4234-8234-123456789abc';
  assert.equal(createId({randomUUID:()=>known,getRandomValues(){throw new Error('No debe llamarse');}}),known);
});
