export type MemoryKind = 'trip' | 'event' | 'moment';
export type SubjectKind = 'person' | 'animal';
/** Coordenadas del punto focal de una portada, en porcentajes de 0 a 100. */
export interface CoverPosition { x:number; y:number }
export interface ImportantBirthday {
  id:string;
  name:string;
  date:string; // YYYY-MM-DD
}

export interface AppSettings {
  id:'main';
  homeCoverPhotoId?:string;
  homeCoverPosition?:CoverPosition;
  yearCoverPhotoIds?:Record<string,string>;
  yearCoverPositions?:Record<string,CoverPosition>;
  relationshipStartedOn:string;
  myName:string;
  myBirthday:string;
  partnerName:string;
  partnerBirthday:string;
  importantBirthdays:ImportantBirthday[];
  showTraditions?:boolean;
}

export const defaultSettings:AppSettings={
  id:'main',relationshipStartedOn:'',myName:'Yo',myBirthday:'',
  partnerName:'Mi pareja',partnerBirthday:'',importantBirthdays:[],showTraditions:true
};

export type DateSource = 'exif' | 'file' | 'manual';

export interface Memory {
  id: string;
  title: string;
  kind: MemoryKind;
  description: string;
  startDate: string; // YYYY-MM-DD, fecha civil local (no UTC)
  endDate: string;
  place: string;
  latitude?: number;
  longitude?: number;
  favorite: boolean;
  coverPhotoId?: string;
  coverPosition?:CoverPosition;
  createdAt: string;
}

export interface PhotoCollection {
  id:string;
  title:string;
  photoIds:string[];
  createdAt:string;
}

export interface Subject {
  id: string;
  name: string;
  kind: SubjectKind;
  notes: string;
}

export interface Photo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  hash: string;
  takenOn: string; // YYYY-MM-DD
  takenTime?: string; // HH:mm
  dateSource: DateSource;
  place: string;
  latitude?: number;
  longitude?: number;
  memoryIds: string[];
  subjectIds: string[];
  description: string;
  favorite: boolean;
  createdAt: string;
}

export interface LocalOperation {
  id: string;
  type: 'upsert' | 'delete';
  entity: 'photo' | 'memory' | 'subject' | 'settings' | 'collection';
  entityId: string;
  createdAt: string;
}

export interface ImportOptions {
  overrideDate?: string;
  place: string;
  memoryId?: string;
  subjectIds: string[];
}

export type Page = 'inicio' | 'anios' | 'calendario' | 'dia' | 'viajes' | 'recuerdos' | 'lugares' | 'personas' | 'colecciones' | 'album' | 'buscar' | 'favoritos' | 'papelera' | 'ajustes' | 'memoria';
