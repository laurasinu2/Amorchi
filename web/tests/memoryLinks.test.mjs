import test from 'node:test';
import assert from 'node:assert/strict';
import { unlinkMemory } from '../src/memoryLinks.ts';

test('Eliminar un viaje desvincula su ID sin modificar archivos ni otros recuerdos',()=>{
  const photo={id:'photo-1',memoryIds:['trip-1','moment-2'],filename:'foto.jpg',favorite:true};
  const result=unlinkMemory(photo,'trip-1');
  assert.deepEqual(result.memoryIds,['moment-2']);
  assert.equal(result.filename,'foto.jpg');
  assert.equal(result.favorite,true);
  assert.deepEqual(photo.memoryIds,['trip-1','moment-2']); // no mutación
});
test('La foto ajena a ese recuerdo queda sin cambios',()=>{
  const photo={id:'photo-2',memoryIds:['event-2']};
  assert.equal(unlinkMemory(photo,'trip-1'),photo);
});
test('Una foto vinculada exclusivamente al recuerdo pasa al álbum sin grupo',()=>{
  const photo={id:'photo-3',memoryIds:['trip-1']};
  assert.deepEqual(unlinkMemory(photo,'trip-1').memoryIds,[]);
});
