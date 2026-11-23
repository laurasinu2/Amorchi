import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { CalendarDays, Check, ImagePlus, Link2, MapPin, Trash2, X } from 'lucide-react';
import { dateLabel } from '../dates';
import { inspectPhoto, type PhotoInspection } from '../db';
import type { ImportOptions, Memory, Subject } from '../types';
import { createId } from '../id';
import './importer-cards.css';

type Draft = {
  id: string;
  file: File;
  preview: string;
  inspection?: PhotoInspection;
  date: string;
  place: string;
  memoryId: string;
  editedDate: boolean;
};
type Editor = { id: string; field: 'date' | 'place' | 'memory' } | null;

export function ImportDialog({ memories, subjects, onClose, onCommit, initialDate }: {
  memories: Memory[];
  subjects: Subject[];
  onClose: () => void;
  initialDate?: string;
  onCommit: (files: File[], options: ImportOptions) => Promise<{ imported: number; errors: string[] }>;
}) {
  const [items, setItems] = useState<Draft[]>([]);
  const [editor, setEditor] = useState<Editor>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const drafts = useRef<Draft[]>([]);
  useEffect(() => { drafts.current = items; }, [items]);
  useEffect(() => () => { drafts.current.forEach(item => URL.revokeObjectURL(item.preview)); }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        if (editor) setEditor(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, editor, busy]);

  async function addFiles(list: FileList | File[]) {
    if (busy) return;
    const photos = Array.from(list).filter(file =>
      file.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|webp|avif)$/i.test(file.name)
    );
    if (!photos.length) {
      setErrors(['Selecciona archivos de imagen.']);
      return;
    }
    const incoming: Draft[] = photos.map(file => ({
      id: createId(), file, preview: URL.createObjectURL(file),
      date: initialDate || '', place: '', memoryId: '', editedDate: Boolean(initialDate)
    }));
    setItems(prev => [...prev, ...incoming]);
    setErrors([]); setDone(0); setInspecting(true);
    await Promise.all(incoming.map(async item => {
      try {
        const inspection = await inspectPhoto(item.file);
        setItems(prev => prev.map(current =>
          current.id === item.id
            ? { ...current, inspection, date: current.editedDate ? current.date : inspection.takenOn }
            : current
        ));
      } catch {
        setItems(prev => prev.map(current => current.id === item.id
          ? { ...current, date: current.editedDate ? current.date : '' }
          : current));
      }
    }));
    setInspecting(false);
  }

  function update(id: string, patch: Partial<Draft>) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  function remove(id: string) {
    const target = items.find(item => item.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    setItems(prev => prev.filter(item => item.id !== id));
    if (editor?.id === id) setEditor(null);
  }
  function dropped(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    void addFiles(e.dataTransfer.files);
  }
  function selected(e: ChangeEvent<HTMLInputElement>) {
    void addFiles(e.target.files || []);
    e.target.value = '';
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !items.length) return;
    setBusy(true); setErrors([]); setDone(0);
    try {
      const result = await onCommit(items.map(item => item.file), {
        place: '', subjectIds: selectedSubjects,
        perFile: items.map(item => ({
          overrideDate: item.editedDate ? item.date || undefined : undefined,
          place: item.place,
          memoryId: item.memoryId || undefined,
        }))
      });
      setDone(result.imported);
      setErrors(result.errors);
      if (!result.errors.length) onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally { setBusy(false); }
  }
  const current = editor ? items.find(item => item.id === editor.id) : undefined;
  const meta = (item: Draft) => [
    { icon: CalendarDays, text: item.date ? dateLabel(item.date, 'short') : 'Sin fecha' },
    { icon: MapPin, text: item.place || (item.inspection?.latitude !== undefined ? 'GPS detectado' : 'Sin lugar') },
    { icon: Link2, text: memories.find(memory => memory.id === item.memoryId)?.title || 'Sin asociar' }
  ];

  return <div className="dialog-backdrop memrly-import-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget && !busy && !editor) onClose();
  }}>
    <section className="dialog wide memrly-import-dialog" role="dialog" aria-modal="true" aria-label="Importar fotografías">
      <header className="dialog-header"><h2>Importar fotografías</h2>
        <button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={21}/></button>
      </header>
      <form className="memrly-import-layout" onSubmit={submit}>
        <div className="memrly-import-intro">
          <div className="memrly-import-steps" aria-label="Pasos de importación">
            <span className="is-active">1. Seleccionar</span><span>2. Organizar</span><span>3. Guardar offline</span>
          </div>
          <div className="memrly-import-drop" role="button" tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
            onDragOver={e => e.preventDefault()} onDrop={dropped}>
            <ImagePlus size={30}/><div><strong>Añadir más fotografías</strong>
              <small>Arrastra imágenes aquí o haz clic para seleccionar archivos</small></div>
          </div>
          <input ref={input} className="memrly-import-file-input" aria-label="Seleccionar fotografías"
            type="file" accept="image/*,.heic,.heif" multiple onChange={selected}/>
        </div>
        <div className="memrly-import-scroll" aria-label="Fotografías seleccionadas" tabIndex={0}>
          {items.length === 0
            ? <div className="memrly-import-empty">Selecciona fotografías para organizarlas antes de guardarlas.</div>
            : <div className="memrly-import-grid">{items.map(item => <article key={item.id} className="memrly-import-card">
                <div className="memrly-import-image">
                  <img src={item.preview} alt={item.file.name} loading="lazy"/>
                  <button type="button" className="memrly-import-remove" aria-label={'Quitar ' + item.file.name}
                    title="Quitar fotografía" onClick={() => remove(item.id)} disabled={busy}><Trash2 size={17}/></button>
                </div>
                <div className="memrly-import-card-content">
                  <strong className="memrly-import-filename" title={item.file.name}>{item.file.name}</strong>
                  <div className="memrly-import-tools">
                    <button type="button" onClick={() => setEditor({ id: item.id, field: 'date' })}><CalendarDays size={14}/> Fecha</button>
                    <button type="button" onClick={() => setEditor({ id: item.id, field: 'place' })}><MapPin size={14}/> Lugar</button>
                    <button type="button" onClick={() => setEditor({ id: item.id, field: 'memory' })}><Link2 size={14}/> Asociar</button>
                  </div>
                  <div className="memrly-import-meta">{meta(item).map(({icon: Icon, text},i) =>
                    <span key={i} title={text}><Icon size={14}/><span>{text}</span></span>)}</div>
                </div>
              </article>)}</div>}
        </div>
        <div className="memrly-import-bottom">
          <div className="memrly-import-count"><ImagePlus size={20}/><div>
            <strong>{items.length} {items.length === 1 ? 'fotografía seleccionada' : 'fotografías seleccionadas'}</strong>
            <small>{inspecting ? 'Leyendo metadatos…' : 'Fecha y GPS detectados cuando existen. Los cambios se guardan por fotografía.'}</small>
          </div></div>
          <div className="memrly-import-bottom-buttons">
            <button type="button" className="memrly-import-cancel" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="submit" className="memrly-import-submit" disabled={busy || !items.length || inspecting}>
              {busy ? 'Guardando…' : `Importar ${items.length} ${items.length === 1 ? 'fotografía' : 'fotografías'}`}
            </button>
          </div>
        </div>
        {subjects.length > 0 && <details className="memrly-import-subjects"><summary>Personas y mascotas (opcional, aplicar a todas)</summary>
          <div className="chips">{subjects.map(subject => <button type="button" key={subject.id}
            className={'chip ' + (selectedSubjects.includes(subject.id) ? 'selected' : '')}
            onClick={() => setSelectedSubjects(previous => previous.includes(subject.id)
              ? previous.filter(id => id !== subject.id) : [...previous, subject.id])}>
            {subject.kind === 'animal' ? '🐾' : '♡'} {subject.name}{selectedSubjects.includes(subject.id) && <Check size={12}/>}
          </button>)}</div>
        </details>}
        {done > 0 && <p role="status" className="success-text">{done} fotografías guardadas en este dispositivo.</p>}
        {errors.length > 0 && <div role="alert" className="form-errors">{errors.slice(0,8).map((err,i) => <p key={i}>{err}</p>)}</div>}
      </form>
      {current && editor && <div className="memrly-import-editor-backdrop" onMouseDown={e => {
        if (e.currentTarget === e.target) setEditor(null);
      }}><section role="dialog" aria-modal="true" aria-label="Editar metadatos" className="memrly-import-editor">
        <div className="memrly-import-editor-header"><h3>{editor.field === 'date' ? 'Redefinir fecha' : editor.field === 'place' ? 'Redefinir lugar' : 'Asociar a un recuerdo'}</h3>
          <button type="button" aria-label="Cerrar edición" onClick={() => setEditor(null)}><X size={18}/></button></div>
        <p className="memrly-import-editor-filename">{current.file.name}</p>
        {editor.field === 'date' && <label className="field"><span>Fecha de la fotografía</span>
          <input type="date" value={current.date} onChange={e => update(current.id, {date: e.target.value, editedDate: true})}/></label>}
        {editor.field === 'place' && <label className="field"><span>Lugar</span>
          <input autoFocus value={current.place} maxLength={180} placeholder="Barcelona, Roma…" onChange={e => update(current.id, {place:e.target.value})}/></label>}
        {editor.field === 'memory' && <label className="field"><span>Viaje, evento o recuerdo</span>
          <select value={current.memoryId} onChange={e => update(current.id, {memoryId:e.target.value})}>
            <option value="">Sin asociar</option>
            {memories.map(memory => <option key={memory.id} value={memory.id}>{memory.title} · {dateLabel(memory.startDate,'short')}</option>)}
          </select></label>}
        {editor.field === 'place' && current.inspection?.latitude !== undefined &&
          <small>GPS EXIF: {current.inspection.latitude.toFixed(5)}, {current.inspection.longitude?.toFixed(5)}. Las coordenadas originales se conservan.</small>}
        <button type="button" className="memrly-import-submit" onClick={() => setEditor(null)}>Guardar cambios</button>
      </section></div>}
    </section>
  </div>;
}
