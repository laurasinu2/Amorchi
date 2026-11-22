import { useEffect, useState, type ComponentType } from 'react';
import { CalendarDays, CloudUpload, Compass, Heart, Home, Images, Layers, MapPin, Menu, Plane, Plus, Search, Settings, Star, Trash2, Users, WifiOff } from 'lucide-react';
import { defaultSettings, type AppSettings, type CoverPosition, type ImportOptions, type Memory, type MemoryKind, type Page, type Photo, type PhotoCollection, type Subject } from './types';
import { localISO } from './dates';
import { deleteMemory, deletePhoto, importPhoto, loadLibrary, saveCollection, saveMemory, savePhoto, saveSubject, saveSettings } from './db';
import { ImportDialog, MemoryDeleteDialog, MemoryDialog, PhotoDialog, SubjectDialog } from './components/Dialogs';
import { CoverPicker } from './components/CoverPicker';
import { AddToCollectionDialog, CollectionsPage } from './components/Collections';
import { AlbumPage, CalendarPage, Dashboard, EmptyState, MemoriesPage, MemoryDetail, PeoplePage, PlacesPage, SearchPage, SettingsPage, YearsPage, type CalendarMode } from './Pages';

type Icon=ComponentType<{size?:number;strokeWidth?:number}>;
const sidebarItems:{page:Page;label:string;icon:Icon}[]=[
  {page:'inicio',label:'Inicio',icon:Home},
  {page:'anios',label:'Años',icon:CalendarDays},
  {page:'viajes',label:'Viajes',icon:Plane},
  {page:'recuerdos',label:'Recuerdos',icon:Heart},
  {page:'lugares',label:'Lugares',icon:MapPin},
  {page:'personas',label:'Personas y mascotas',icon:Users},
  {page:'colecciones',label:'Colecciones',icon:Layers},
  {page:'buscar',label:'Buscar',icon:Search},
  {page:'favoritos',label:'Favoritos',icon:Star},
  {page:'papelera',label:'Papelera',icon:Trash2},
  {page:'ajustes',label:'Ajustes',icon:Settings}
];
const bottomItems:{page:Page;label:string;icon:Icon}[]=[
  {page:'inicio',label:'Inicio',icon:Home},
  {page:'calendario',label:'Calendario',icon:CalendarDays},
  {page:'viajes',label:'Viajes',icon:Compass},
  {page:'album',label:'Álbum',icon:Images}
];
export default function App(){
  const [page,setPage]=useState<Page>('inicio');
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [memories,setMemories]=useState<Memory[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [collections,setCollections]=useState<PhotoCollection[]>([]);
  const [settings,setSettings]=useState<AppSettings>(defaultSettings);
  const [coverTarget,setCoverTarget]=useState<'home'|{memoryId:string}|{year:number}|null>(null);
  const [pending,setPending]=useState(0);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [isOnline,setOnline]=useState(navigator.onLine);
  const [menu,setMenu]=useState(false);
  const [year,setYear]=useState(new Date().getFullYear());
  const [month,setMonth]=useState(new Date().getMonth());
  const [selectedDay,setSelectedDay]=useState(localISO(new Date()));
  const [calendarMode,setCalendarMode]=useState<CalendarMode>('year');
  const [selectedMemoryId,setSelectedMemoryId]=useState<string|undefined>();
  const [memoryToDeleteId,setMemoryToDeleteId]=useState<string|undefined>();
  const [selectedPhotoId,setSelectedPhotoId]=useState<string|undefined>();
  const [importOpen,setImportOpen]=useState(false);
  const [importDate,setImportDate]=useState<string|undefined>();
  const [memoryDate,setMemoryDate]=useState<string|undefined>();
  const [collectionDate,setCollectionDate]=useState<string|undefined>();
  const [memoryOpen,setMemoryOpen]=useState(false);
  const [editMemory,setEditMemory]=useState<Memory|undefined>();
  const [newKind,setNewKind]=useState<MemoryKind>('moment');
  const [subjectOpen,setSubjectOpen]=useState(false);

  async function refresh(){
    const library=await loadLibrary();
    setPhotos(library.photos);setMemories(library.memories);
    setSubjects(library.subjects);setPending(library.operations.length);setSettings(library.settings);setCollections(library.collections);
  }
  useEffect(()=>{
    refresh().catch(e=>setError('No se pudo abrir el almacenamiento local: '+String(e))).finally(()=>setReady(true));
    const online=()=>setOnline(true),offline=()=>setOnline(false);
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    return ()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
  },[]);
  function navigate(to:Page){
    setPage(to);setMenu(false);window.scrollTo({top:0,behavior:'instant'});
  }
  function openMemory(id:string){setSelectedMemoryId(id);navigate('memoria');}
  function openCalendarYear(y:number){
    setYear(y);setCalendarMode('year');
    setSelectedDay(day=>day.startsWith(String(y))?day:`${y}-01-01`);
    navigate('calendario');
  }
  function openCalendarMonth(y:number,m:number){
    setYear(y);setMonth(m);setCalendarMode('month');
    const prefix=`${y}-${String(m+1).padStart(2,'0')}`;
    setSelectedDay(day=>day.startsWith(prefix)?day:prefix+'-01');
    navigate('calendario');
  }
  function openCalendarDay(day:string){
    setSelectedDay(day);setYear(Number(day.slice(0,4)));setMonth(Number(day.slice(5,7))-1);
    setCalendarMode(current=>current==='year'?'month':current);
    navigate('calendario');
  }
  function createMemory(kind:MemoryKind='moment',initialDate?:string){
    setEditMemory(undefined);setNewKind(kind);setMemoryDate(initialDate);setMemoryOpen(true);
  }
  function openImport(initialDate?:string){
    setImportDate(initialDate);
    setImportOpen(true);
  }
  async function commitMemory(memory:Memory){await saveMemory(memory);await refresh();}
  async function commitCollection(collection:PhotoCollection){await saveCollection(collection);await refresh();}
  async function commitSettings(next:AppSettings){
    await saveSettings(next);await refresh();
  }
  async function commitCover(photoId?:string,position?:CoverPosition){
    if(coverTarget==='home'){
      await commitSettings({...settings,homeCoverPhotoId:photoId,homeCoverPosition:photoId?position:undefined});
    }else if(coverTarget&&'year' in coverTarget){
      const nextYears={...(settings.yearCoverPhotoIds||{})};
      const nextPositions={...(settings.yearCoverPositions||{})};
      if(photoId){nextYears[String(coverTarget.year)]=photoId;nextPositions[String(coverTarget.year)]=position||{x:50,y:50};}
      else {delete nextYears[String(coverTarget.year)];delete nextPositions[String(coverTarget.year)];}
      await commitSettings({...settings,yearCoverPhotoIds:nextYears,yearCoverPositions:nextPositions});
    }else if(coverTarget&&'memoryId' in coverTarget){
      const memory=memories.find(m=>m.id===coverTarget.memoryId);
      if(!memory)throw new Error('No se encontró el recuerdo.');
      await saveMemory({...memory,coverPhotoId:photoId,coverPosition:photoId?position:undefined});
      await refresh();
    }
  }
  async function commitDeleteMemory(){
    const memory=memories.find(m=>m.id===memoryToDeleteId);
    if(!memory)throw new Error('El recuerdo ya no está disponible.');
    await deleteMemory(memory.id);
    await refresh();
    setMemoryToDeleteId(undefined);
    setSelectedMemoryId(undefined);
    navigate(memory.kind==='trip'?'viajes':'recuerdos');
  }
  async function commitSubject(subject:Subject){await saveSubject(subject);await refresh();}
  async function commitPhoto(photo:Photo){await savePhoto(photo);await refresh();}
  async function commitDeletePhoto(id:string){
    await deletePhoto(id);
    await refresh();
  }
  async function commitImport(files:File[],options:ImportOptions){
    const errors:string[]=[];let imported=0;
    for(const file of files){
      try{await importPhoto(file,options);imported++;}
      catch(err){errors.push(file.name+': '+(err instanceof Error?err.message:String(err)));}
    }
    await refresh();if(imported>0)navigate('album');
    return {imported,errors};
  }
  const selectedMemory=memories.find(m=>m.id===selectedMemoryId);
  const selectedPhoto=photos.find(p=>p.id===selectedPhotoId);
  const mainTitle=({inicio:'Inicio',anios:'Nuestros años',calendario:'Calendario',dia:'Calendario',viajes:'Viajes',recuerdos:'Recuerdos',lugares:'Mapa de recuerdos',personas:'Personas y mascotas',colecciones:'Colecciones',album:'Galería',buscar:'Buscar',favoritos:'Favoritos',papelera:'Papelera',ajustes:'Ajustes',memoria:selectedMemory?.title||'Recuerdo'} as Record<Page,string>)[page];
  return <div className="app-shell">
    <aside className={'sidebar '+(menu?'mobile-open':'')}>
      <div className="sidebar-logo"><img className="sidebar-app-icon" src="/brand/recuerdos-app.webp" alt="" /><div><strong>Recuerdos</strong><small>ÁLBUM AMORCHI</small></div></div>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {sidebarItems.map((item,i)=><div key={item.page}>
          {(i===7||i===10)&&<hr/>}
          <button className={'sidebar-link '+(page===item.page||(page==='calendario'&&item.page==='anios')?'active':'')} onClick={()=>navigate(item.page)}><item.icon size={19}/><span>{item.label}</span></button>
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-sync"><CloudUpload size={21}/><div><strong>Modo local</strong><small>{pending} cambios pendientes</small></div></div><span className="sidebar-foot">Amorchi · Primera versión</span></div>
    </aside>
    {menu&&<button className="menu-scrim" aria-label="Cerrar menú" onClick={()=>setMenu(false)}/>}
    <div className="app-content">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={()=>setMenu(true)}><Menu/></button><img className="topbar-brand-image" src="/brand/recuerdos-horizontal.webp" alt="Recuerdos, álbum Amorchi" /><span className="breadcrumbs">/ {mainTitle}</span></div><div className="topbar-right"><span className={'sync-indicator '+(!isOnline?'offline':'')} title="Servidor aún no conectado">{isOnline?<CloudUpload size={16}/>:<WifiOff size={16}/>}<span>{!isOnline?'Sin conexión':'Datos locales'}</span><b>{pending}</b></span><span className="topbar-divider" aria-hidden="true"/> <button className="btn topbar-add" onClick={()=>openImport()}><Plus size={17}/> Subir fotos</button></div></header>
      <main className="main-container">
        {!ready?<div className="empty-state"><h2>Abriendo tus recuerdos...</h2></div>:<>
          {error&&<div className="form-errors" role="alert">{error}</div>}
          {page==='inicio'&&<Dashboard photos={photos} memories={memories} settings={settings} onChangeCover={()=>setCoverTarget('home')} onNavigate={navigate} onOpenMemory={openMemory} onViewPhoto={setSelectedPhotoId} onImport={()=>openImport()} onCreateMemory={createMemory}/>}

          {page==='anios'&&<YearsPage photos={photos} memories={memories} settings={settings} onChangeCover={year=>setCoverTarget({year})} onYear={openCalendarYear} onNavigate={navigate} onOpenMemory={openMemory}/>}
          {(page==='calendario'||page==='dia')&&<CalendarPage year={year} month={month} mode={calendarMode} selectedDay={selectedDay} photos={photos} memories={memories} settings={settings} onMode={setCalendarMode} onYear={openCalendarYear} onMonth={openCalendarMonth} onDay={openCalendarDay} onViewPhoto={setSelectedPhotoId} onAddPhotos={openImport} onCreateMemory={day=>createMemory('moment',day)} onAddToCollection={day=>setCollectionDate(day)}/>}
          {page==='viajes'&&<MemoriesPage memories={memories} photos={photos} onlyTrips onOpen={openMemory} onCreate={()=>createMemory('trip')}/>}
          {page==='recuerdos'&&<MemoriesPage memories={memories} photos={photos} onlyTrips={false} onOpen={openMemory} onCreate={()=>createMemory('moment')}/>}
          {page==='memoria'&&(selectedMemory?<MemoryDetail memory={selectedMemory} memories={memories} photos={photos} subjects={subjects} settings={settings} onChangeCover={()=>setCoverTarget({memoryId:selectedMemory.id})} onDelete={()=>setMemoryToDeleteId(selectedMemory.id)} onViewPhoto={setSelectedPhotoId} onEdit={()=>{setEditMemory(selectedMemory);setMemoryOpen(true);}} onOpenMemory={openMemory}/>:<EmptyState title="Recuerdo no encontrado" description="Vuelve a tus recuerdos desde el menú." onAction={()=>navigate('recuerdos')} action="Ver recuerdos"/>)}
          {page==='lugares'&&<PlacesPage memories={memories} onOpen={openMemory}/>}
          {page==='personas'&&<PeoplePage subjects={subjects} photos={photos} onCreate={()=>setSubjectOpen(true)} onView={setSelectedPhotoId}/>}
          {page==='album'&&<AlbumPage photos={photos} onView={setSelectedPhotoId}/>}
          {page==='favoritos'&&<AlbumPage photos={photos} onView={setSelectedPhotoId} filterFavorites/>}
          {page==='buscar'&&<SearchPage photos={photos} memories={memories} onView={setSelectedPhotoId} onOpen={openMemory}/>}
          {page==='ajustes'&&<SettingsPage pending={pending} settings={settings} onSaveSettings={commitSettings}/>}
          {page==='colecciones'&&<CollectionsPage collections={collections} photos={photos} onView={setSelectedPhotoId} onCreate={day=>setCollectionDate(day)}/>}
          {page==='papelera'&&<EmptyState title="Papelera" description="El borrado seguro y la recuperación de fotos se añadirán con el servidor. Esta versión no borra originales desde la interfaz."/>}
        </>}
      </main>
    </div>
    <nav className="mobile-bottom" aria-label="Navegación móvil">
      {bottomItems.slice(0,2).map(item=><button key={item.page} className={page===item.page?'active':''} onClick={()=>navigate(item.page)}><item.icon size={23}/><span>{item.label}</span></button>)}
      <button className="add-tab" onClick={()=>setImportOpen(true)} aria-label="Subir fotografías"><Plus size={31}/><span>Subir</span></button>
      {bottomItems.slice(2).map(item=><button key={item.page} className={page===item.page?'active':''} onClick={()=>navigate(item.page)}><item.icon size={23}/><span>{item.label}</span></button>)}
    </nav>
    {coverTarget&&<CoverPicker photos={coverTarget&&coverTarget!=='home'&&'year' in coverTarget?photos.filter(p=>p.takenOn.startsWith(String(coverTarget.year))):photos} title={coverTarget==='home'?'Elegir foto de fondo de Inicio':'year' in coverTarget?`Portada del año ${coverTarget.year}`:'Elegir foto de fondo del recuerdo'} selectedId={coverTarget==='home'?settings.homeCoverPhotoId:'year' in coverTarget?settings.yearCoverPhotoIds?.[String(coverTarget.year)]:memories.find(m=>m.id===coverTarget.memoryId)?.coverPhotoId} selectedPosition={coverTarget==='home'?settings.homeCoverPosition:'year' in coverTarget?settings.yearCoverPositions?.[String(coverTarget.year)]:memories.find(m=>m.id===coverTarget.memoryId)?.coverPosition} onClose={()=>setCoverTarget(null)} onSelect={commitCover}/>}
    {memoryToDeleteId&&memories.find(m=>m.id===memoryToDeleteId)&&<MemoryDeleteDialog memory={memories.find(m=>m.id===memoryToDeleteId)!} photoCount={photos.filter(p=>p.memoryIds.includes(memoryToDeleteId)).length} onClose={()=>setMemoryToDeleteId(undefined)} onConfirm={commitDeleteMemory}/>}
    {importOpen&&<ImportDialog initialDate={importDate} memories={memories} subjects={subjects} onClose={()=>{setImportOpen(false);setImportDate(undefined);}} onCommit={commitImport}/>}
    {memoryOpen&&<MemoryDialog initial={editMemory} initialDate={memoryDate} defaultKind={newKind} onClose={()=>{setMemoryOpen(false);setMemoryDate(undefined);}} onSave={commitMemory}/>}
    {collectionDate&&<AddToCollectionDialog date={collectionDate} photos={photos} collections={collections} onClose={()=>setCollectionDate(undefined)} onSave={commitCollection}/>}
    {subjectOpen&&<SubjectDialog onClose={()=>setSubjectOpen(false)} onSave={commitSubject}/>}
    {selectedPhoto&&<PhotoDialog photo={selectedPhoto} memories={memories} subjects={subjects} onClose={()=>setSelectedPhotoId(undefined)} onSave={commitPhoto} onDelete={commitDeletePhoto}/>}
  </div>;
}
