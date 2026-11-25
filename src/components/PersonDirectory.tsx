import { displayGivenName, t, useLanguage } from '../i18n';
import { useId, useMemo, useRef, useState, useEffect } from 'react';
import { Menu, Search, X } from 'lucide-react';
import type { Person, DemoConnection } from '../types';
import { directoryPeople } from '../mocks/personDirectory';
import { familyName } from '../mocks/familyView';

export function PersonDirectory({
  people,
  connections,
  open,
  onToggle,
  onFocus,
}: {
  people: Person[];
  connections: DemoConnection[];
  open: boolean;
  onToggle: () => void;
  onFocus: (id: string) => void;
}) {
  useLanguage();
  const [tab, setTab] = useState<'all' | 'isolated'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const results = useMemo(
    () => directoryPeople(people, connections, query, tab === 'isolated'),
    [people, connections, query, tab],
  );
  const isolatedCount = useMemo(
    () => directoryPeople(people, connections, '', true).length,
    [people, connections],
  );
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  return (
    <>
      <button
        ref={toggle}
        type="button"
        className="directory-toggle icon-btn"
        aria-label={open ? t('Zamknij listę osób') : t('Otwórz listę osób')}
        title={t('Lista osób')}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <Menu size={18} />
      </button>
      {open && (
        <aside
          id={id}
          className="person-directory"
          aria-label={t('Lista osób w drzewie')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onToggle();
              toggle.current?.focus();
            }
          }}
        >
          <div className="directory-heading">
            <h3>{t('Osoby w drzewie')}</h3>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('Zamknij panel osób')}
              onClick={() => {
                onToggle();
                toggle.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="directory-tabs" aria-label={t('Filtr osób')}>
            <button
              type="button"
              aria-pressed={tab === 'all'}
              onClick={() => setTab('all')}
            >
              {t('Wszystkie (')}
              {people.length})
            </button>
            <button
              type="button"
              aria-pressed={tab === 'isolated'}
              onClick={() => setTab('isolated')}
            >
              {t('Bez połączeń (')}
              {isolatedCount})
            </button>
          </div>
          <label className="directory-search">
            <Search size={14} />
            <input
              ref={input}
              aria-label={t('Szukaj na liście osób')}
              placeholder={t('Nazwisko lub imię…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="icon-btn"
                aria-label={t('Wyczyść filtr listy')}
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <p className="directory-count" role="status">
            {t('{0} osób · według nazwiska rodowego', results.length)}
          </p>
          <ul className="directory-results">
            {results.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  aria-label={t(
                    'Znajdź na drzewie: {0} {1}',
                    displayGivenName(person),
                    familyName(person),
                  )}
                  aria-current={selected === person.id ? 'true' : undefined}
                  onClick={() => {
                    setSelected(person.id);
                    onFocus(person.id);
                  }}
                >
                  <strong>
                    {familyName(person) || t('Nieznane nazwisko')}
                  </strong>
                  <span>{displayGivenName(person) || t('Nieznane imię')}</span>
                  <small>
                    {person.birth || t('Nieznana data')}
                    {person.death ? ` — ${person.death}` : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p className="directory-empty">
              {query
                ? t('Brak osób pasujących do wyszukiwania.')
                : tab === 'isolated'
                  ? t('Każda osoba ma przynajmniej jedno połączenie.')
                  : t('Nie dodano jeszcze osób.')}
            </p>
          )}
        </aside>
      )}
    </>
  );
}
