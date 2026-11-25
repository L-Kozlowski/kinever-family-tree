export type GeoLocation = {
  lat: number;
  lon: number;
  label?: string;
  source?: 'manual' | 'nominatim' | 'gedcom';
};
export type Person = {
  id: string;
  firstName: string;
  familiarName?: string;
  lastName: string;
  maidenName: string;
  birth: string;
  death: string;
  birthPlace: string;
  birthLocation?: GeoLocation;
  residenceLocation?: GeoLocation;
  residence: string;
  notes: string;
  portrait: number;
  customPortrait?: boolean;
  photo?: string;
  attachments?: Attachment[];
  gender?: string;
  isPlaceholder?: boolean;
};
export type SurnameFamily = {
  id: string;
  masculine: string;
  feminine: string;
  aliases: string[];
};
export type FamilyTree = {
  id: string;
  name: string;
  description: string;
  surnameFamilies?: SurnameFamily[];
  people: Person[];
  updated: string;
};
export type RelationKind = 'parent' | 'child' | 'sibling' | 'partner';
export type DemoRelationOptions = {
  profile?: Pick<
    Person,
    'firstName' | 'lastName' | 'birth' | 'death' | 'birthPlace' | 'residence'
  >;
  familiarName?: string;
  parentIds?: string[];
  coParentId?: string;
  adopted?: boolean;
  gender?: string;
};
export type RevealRelative = {
  id: string;
  relativeTo: string;
  kind: RelationKind;
  token: string;
};
export type DemoConnection = {
  id: string;
  source: string;
  target: string;
  kind: string;
};
export type Attachment = {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  caption?: string;
};
