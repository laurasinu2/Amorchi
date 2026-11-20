/**
 * Crea UUID v4 incluso en HTTP en una Wi-Fi doméstica.
 * randomUUID solo está disponible con HTTPS; getRandomValues sí funciona en HTTP.
 * Nunca usar Math.random para IDs de sincronización.
 */
export function createId(source: Pick<Crypto,'getRandomValues'> & Partial<Pick<Crypto,'randomUUID'>> = globalThis.crypto):string {
  if(typeof source?.randomUUID==='function')return source.randomUUID();
  if(typeof source?.getRandomValues!=='function')throw new Error('El navegador no dispone de aleatoriedad segura.');
  const bytes=new Uint8Array(16);
  source.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
