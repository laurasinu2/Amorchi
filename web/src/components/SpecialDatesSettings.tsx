import { useEffect, useState, type FormEvent } from 'react';
import { CalendarHeart, Cake, Plus, Save, Trash2 } from 'lucide-react';
import type { AppSettings } from '../types';
import { createId } from '../id';

export function SpecialDatesSettings({settings,onSave}:{
  settings:AppSettings;onSave:(settings:AppSettings)=>Promise<void>;
}){
  const [draft,setDraft]=useState(settings);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  useEffect(()=>setDraft(settings),[settings]);
  function patch(p:Partial<AppSettings>){setDraft(d=>({...d,...p}));setSaved(false);}
  function addBirthday(){
    patch({importantBirthdays:[...draft.importantBirthdays,{id:createId(),name:'',date:''}]});
  }
  function changeBirthday(id:string,name:string,date:string){
    patch({importantBirthdays:draft.importantBirthdays.map(b=>b.id===id?{...b,name,date}:b)});
  }
  function removeBirthday(id:string){
    patch({importantBirthdays:draft.importantBirthdays.filter(b=>b.id!==id)});
  }
  async function submit(e:FormEvent){
    e.preventDefault();setError('');setSaved(false);
    if(draft.importantBirthdays.some(b=>!b.name.trim()||!b.date)){
      setError('Completa el nombre y la fecha de cada cumpleaños especial, o elimina las filas vacías.');return;
    }
    setBusy(true);
    try{
      await onSave({...draft,importantBirthdays:draft.importantBirthdays.map(b=>({...b,name:b.name.trim()}))});
      setSaved(true);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return <section className="panel special-settings">
    <div className="special-heading"><CalendarHeart size={23}/><div><h3>Fechas especiales</h3><p>Se repetirán automáticamente en el calendario todos los años.</p></div></div>
    <form className="form-stack" onSubmit={submit}>
      <div className="settings-fields">
        <label className="field relationship-field"><span>♡ Inicio de nuestra relación</span><input type="date" value={draft.relationshipStartedOn} onChange={e=>patch({relationshipStartedOn:e.target.value})}/><small>En cada aniversario aparecerán un corazón y los años cumplidos en dorado sobre la fotografía de ese día.</small></label>
      </div>
      <h4 className="settings-subheading"><Cake size={17}/> Nuestros cumpleaños</h4>
      <div className="form-grid">
        <div className="birthday-person">
          <label className="field"><span>Tu nombre</span><input value={draft.myName} maxLength={80} onChange={e=>patch({myName:e.target.value})} placeholder="Yo"/></label>
          <label className="field"><span>Tu fecha de nacimiento</span><input type="date" value={draft.myBirthday} onChange={e=>patch({myBirthday:e.target.value})}/></label>
        </div>
        <div className="birthday-person">
          <label className="field"><span>Nombre de tu pareja</span><input value={draft.partnerName} maxLength={80} onChange={e=>patch({partnerName:e.target.value})} placeholder="Mi pareja"/></label>
          <label className="field"><span>Cumpleaños de tu pareja</span><input type="date" value={draft.partnerBirthday} onChange={e=>patch({partnerBirthday:e.target.value})}/></label>
        </div>
      </div>
      <div className="important-birthdays">
        <div className="important-title"><h4 className="settings-subheading"><Cake size={17}/> Otras personas importantes</h4><button className="btn subtle" type="button" onClick={addBirthday}><Plus size={15}/> Añadir cumpleaños</button></div>
        {draft.importantBirthdays.length===0&&<p className="muted-text">Puedes añadir familiares o amigos para recordar sus cumpleaños cada año.</p>}
        {draft.importantBirthdays.map(b=><div className="birthday-entry" key={b.id}>
          <label className="field"><span>Nombre</span><input required maxLength={80} placeholder="Nombre de la persona" value={b.name} onChange={e=>changeBirthday(b.id,e.target.value,b.date)}/></label>
          <label className="field"><span>Fecha de nacimiento</span><input required type="date" value={b.date} onChange={e=>changeBirthday(b.id,b.name,e.target.value)}/></label>
          <button type="button" className="icon-button remove-birthday" title="Eliminar cumpleaños" aria-label={`Eliminar cumpleaños de ${b.name||'esta persona'}`} onClick={()=>removeBirthday(b.id)}><Trash2 size={17}/></button>
        </div>)}
      </div>
      {error&&<p className="form-errors" role="alert">{error}</p>}
      {saved&&<p role="status" className="success-text">Fechas guardadas en este dispositivo. Los marcadores ya aparecen en el calendario.</p>}
      <div className="form-actions"><button type="submit" className="btn primary" disabled={busy}><Save size={16}/>{busy?'Guardando...':'Guardar fechas especiales'}</button></div>
    </form>
  </section>;
}
