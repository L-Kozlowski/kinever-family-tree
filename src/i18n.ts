import { useSyncExternalStore } from 'react';
import english from './en.json';
import type { Person } from './types';
import { familyName } from './mocks/familyView';

export type Language = 'pl' | 'en';
const preferencesKey = 'korzenie-language';
let language: Language =
  localStorage.getItem(preferencesKey) === 'en' ? 'en' : 'pl';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getLanguage = () => language;
let selectedInSession = localStorage.getItem(preferencesKey) !== null;

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

function applyLanguage(value: Language) {
  language = value;
  localStorage.setItem(preferencesKey, value);
  updateDocumentLanguage();
  for (const listener of listeners) listener();
}

export function setLanguage(value: Language) {
  selectedInSession = true;
  applyLanguage(value);
}

export function restoreLanguage(value: Language | null) {
  if (!selectedInSession && value) applyLanguage(value);
}

const messages: Record<string, string> = english;

export function t(message: string, ...values: unknown[]) {
  const template = language === 'en' ? (messages[message] ?? message) : message;
  return template.replace(/\{(\d+)\}/g, (token, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : token,
  );
}

function updateDocumentLanguage() {
  document.documentElement.lang = language;
  document.title = t('KinEver — historie, które nas łączą');
}

updateDocumentLanguage();

export function displayGivenName(person: Person) {
  return person.isPlaceholder ? t(person.firstName) : person.firstName;
}

export function fullName(person: Person) {
  return `${displayGivenName(person)} ${familyName(person)}`.trim();
}

export function serverMessage(message: string) {
  const missing = message.match(/^Brak (\d+) plików wskazanych w GEDCOM\./);
  if (missing) {
    return t(
      'Brak {0} plików wskazanych w GEDCOM. Dane rodzinne zaimportowano; niedostępnych mediów nie pobierano z dysku ani internetu.',
      missing[1],
    );
  }
  const attachmentErrors = [
    [
      'Nieobsługiwany załącznik: ',
      '. Dozwolone: JPEG, PNG, WebP, PDF, TXT i DOCX.',
    ],
    ['Załącznik jest pusty lub przekracza 20 MB: ', ''],
    ['Zawartość załącznika nie pasuje do rozszerzenia: ', ''],
    ['Nieprawidłowy dokument DOCX: ', ''],
  ];
  for (const [prefix, suffix] of attachmentErrors) {
    if (message.startsWith(prefix) && message.endsWith(suffix)) {
      const name = message.slice(prefix.length, message.length - suffix.length);
      return t(`${prefix}{0}${suffix}`, name);
    }
  }
  return t(message);
}
