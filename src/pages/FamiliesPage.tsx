import { fullName, t, useLanguage } from '../i18n';
import { useMemo, useRef, useState } from 'react';
import { Leaf, Search, Users, Pencil, Check, X, GitBranch } from 'lucide-react';
import type { FamilyTree, Person, SurnameFamily } from '../types';
import { surnameGroups, setSurnameForms } from '../mocks/surnameFamilies';

import { Portrait } from '../components/Portrait';
export function FamiliesPage({
  tree,
  onPerson,
  onTree,
  onSave,
}: {
  tree: FamilyTree;
  onPerson: (person: Person) => void;
  onTree: (id: string) => void;
  onSave: (definitions: SurnameFamily[]) => Promise<boolean>;
}) {
  useLanguage();
  const groups = useMemo(
    () => surnameGroups(tree.people, tree.surnameFamilies),
    [tree.people, tree.surnameFamilies],
  );
  const membersRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [male, setMale] = useState('');
  const [female, setFemale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filtered = groups.filter((g) =>
    [g.masculine, g.feminine, ...g.aliases].some((n) =>
      n.toLocaleLowerCase('pl').includes(query.trim().toLocaleLowerCase('pl')),
    ),
  );
  const family = groups.find((g) => g.id === selected);
  const unassigned =
    tree.people.length -
    new Set(groups.flatMap((group) => group.people.map((person) => person.id)))
      .size;
  const mergeNames = groups.filter(
    (g) =>
      g.id !== editing &&
      [g.masculine, g.feminine, ...g.aliases].some((n) =>
        [male, female].some(
          (v) => v.trim().toLocaleLowerCase('pl') === n.toLocaleLowerCase('pl'),
        ),
      ),
  );
  return (
    <section className="families-page" aria-label={t('Rodziny w drzewie')}>
      <div className="families-intro">
        <div>
          <span className="eyebrow">
            {t('WSPÓLNE NAZWISKA · RODZINNE HISTORIE')}
          </span>
          <h2>{t('Rodziny w naszym drzewie')}</h2>
          <p>
            {t(
              'Rodziny: {0} · Przypisane osoby: {1}',
              groups.length,
              tree.people.length - unassigned,
            )}
          </p>
        </div>
        <Leaf size={36} />
      </div>
      <label className="families-search">
        <Search size={16} />
        <input
          aria-label={t('Szukaj rodziny')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Odszukaj rodzinę po nazwisku…')}
        />
      </label>
      <div className="families-workspace">
        <div className="family-catalog" aria-label={t('Katalog rodzin')}>
          {filtered.map((g) => (
            <button
              type="button"
              key={g.id}
              aria-pressed={selected === g.id}
              onClick={() => {
                setSelected(g.id);
                if (membersRef.current) membersRef.current.scrollTop = 0;
                setEditing(null);
                setError('');
              }}
            >
              <span className="family-seal">
                <Leaf size={22} />
              </span>
              <span>
                <strong>
                  {g.masculine === g.feminine
                    ? g.masculine
                    : `${g.masculine} / ${g.feminine}`}
                </strong>
                <small>
                  <Users size={12} /> {t('Liczba osób: {0}', g.people.length)} ·{' '}
                  {g.manual
                    ? t('własne odmiany')
                    : t('rozpoznano automatycznie')}
                </small>
              </span>
            </button>
          ))}
          {!filtered.length && (
            <p className="families-empty">
              {query
                ? t('Brak rodzin pasujących do wyszukiwania.')
                : t(
                    'Dodaj osobę z nazwiskiem, aby rozpocząć rodzinny katalog.',
                  )}
            </p>
          )}
        </div>
        <aside className="family-members" aria-label={t('Członkowie rodziny')}>
          {family ? (
            <>
              <div className="family-members-heading">
                <div>
                  <span className="eyebrow">{t('RODZINNY ALBUM')}</span>
                  <h3>
                    {family.masculine === family.feminine
                      ? family.masculine
                      : `${family.masculine} / ${family.feminine}`}
                  </h3>
                  <p>{t('Liczba osób: {0}', family.people.length)}</p>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(family.id);
                    setMale(family.masculine);
                    setFemale(family.feminine);
                    setError('');
                  }}
                >
                  <Pencil size={14} />
                  {t('Odmiany nazwiska')}
                </button>
              </div>
              {editing === family.id && (
                <form
                  className="family-forms"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busy) return;
                    setError('');
                    setBusy(true);
                    try {
                      const next = setSurnameForms(
                        tree.people,
                        tree.surnameFamilies || [],
                        family.id,
                        male,
                        female,
                      );
                      if (await onSave(next)) setEditing(null);
                      else
                        setError(
                          t(
                            'Nie zapisano odmian. Sprawdź komunikat i spróbuj ponownie.',
                          ),
                        );
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : t('Nie zapisano odmian.'),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    {t('Odmiana męska')}
                    <input
                      required
                      maxLength={500}
                      value={male}
                      onChange={(e) => setMale(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    {t('Odmiana żeńska')}
                    <input
                      required
                      maxLength={500}
                      value={female}
                      onChange={(e) => setFemale(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <p>
                    {t(
                      'Możesz wpisać tę samą formę w obu polach. Nazwiska osób pozostaną bez zmian; wcześniejsze formy nadal należą do tej rodziny.',
                    )}
                  </p>
                  {mergeNames.length > 0 && (
                    <p role="status">
                      {t('Po zapisaniu połączymy także grupy:')}{' '}
                      {mergeNames.map((g) => g.masculine).join(', ')}.
                    </p>
                  )}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="button-row">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      <X size={14} />
                      {t('Anuluj')}
                    </button>
                    <button className="btn primary" disabled={busy}>
                      <Check size={14} />
                      {busy ? t('Zapisywanie…') : t('Zapisz odmiany')}
                    </button>
                  </div>
                </form>
              )}
              <ul className="family-member-list">
                {family.people.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => onPerson(p)}>
                      <Portrait
                        variant={p.portrait}
                        name={fullName(p)}
                        photo={p.photo}
                      />
                      <span>
                        <strong>{fullName(p)}</strong>
                        <small>
                          {p.birth || t('Nieznana data')}
                          {p.death ? ` — ${p.death}` : ''}
                        </small>
                        {p.maidenName && p.maidenName !== p.lastName && (
                          <small>{t('Obecnie: {0}', p.lastName)}</small>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t('Pokaż na drzewie: {0}', fullName(p))}
                      title={t('Pokaż na drzewie')}
                      onClick={() => onTree(p.id)}
                    >
                      <GitBranch size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="families-empty">
              <Leaf size={30} />
              <h3>{t('Każde nazwisko ma swoją historię')}</h3>
              <p>
                {t(
                  'Wybierz rodzinę, aby zobaczyć jej członków i ustawić odmiany nazwiska.',
                )}
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
