import { t, useLanguage } from '../i18n';
import { FamiliesPage } from './FamiliesPage';
import { lazy, Suspense, useState } from 'react';
const BirthMapPage = lazy(() =>
  import('./BirthMapPage').then((module) => ({ default: module.BirthMapPage })),
);
import {
  Map,
  Users,
  Plus,
  Search,
  Upload,
  GitBranch,
  LayoutGrid,
  Hand,
  Image,
  ImageOff,
  X,
} from 'lucide-react';
import type {
  FamilyTree,
  SurnameFamily,
  DemoConnection,
  Person,
  RelationKind,
  RevealRelative,
} from '../types';
import { FamilyCanvas } from '../components/FamilyCanvas';
import { Portrait } from '../components/Portrait';
import { familyName } from '../mocks/familyView';

export function TreePage({
  tree,
  connections,
  onPerson,
  onNew,
  onRelation,
  revealRequest,

  onExport,
  onSaveFamilies,
}: {
  tree: FamilyTree;
  connections: DemoConnection[];
  onPerson: (p: Person) => void;
  onNew: () => void;
  onRelation: (person: Person, kind: RelationKind) => void;
  revealRequest: RevealRelative | null;

  onExport: () => void;
  onSaveFamilies: (definitions: SurnameFamily[]) => Promise<boolean>;
}) {
  useLanguage();
  const [view, setView] = useState<'tree' | 'map' | 'families'>('tree');
  const [portraits, setPortraits] = useState(true);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const results = tree.people.filter((p) =>
    [p.firstName, p.familiarName].some(
      (name) =>
        name &&
        `${name} ${p.lastName} ${p.maidenName}`
          .toLocaleLowerCase('pl')
          .includes(query.toLocaleLowerCase('pl')),
    ),
  );
  return (
    <div className="tree-page">
      <header className="album-header">
        <nav className="family-view-tabs" aria-label={t('Widok albumu')}>
          <button
            className={view === 'tree' ? 'active' : ''}
            aria-pressed={view === 'tree'}
            onClick={() => setView('tree')}
          >
            <GitBranch size={17} />
            {t('Drzewo')}
          </button>
          <button
            className={view === 'map' ? 'active' : ''}
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
          >
            <Map size={17} />
            {t('Mapa urodzeń')}
          </button>
          <button
            className={view === 'families' ? 'active' : ''}
            aria-pressed={view === 'families'}
            onClick={() => setView('families')}
          >
            <Users size={17} />
            {t('Rodziny')}
          </button>
          <div className="album-actions">
            <button className="btn secondary" onClick={onExport}>
              <Upload size={15} />
              {t('Eksportuj')}
            </button>
            <button className="btn primary" onClick={onNew}>
              <Plus size={16} />
              {t('Dodaj osobę')}
            </button>
          </div>
        </nav>
      </header>
      <div
        className="tree-surface"
        style={{ display: view === 'tree' ? 'flex' : 'none' }}
      >
        <div className="tree-toolbar">
          <div className="search-wrap">
            <Search size={17} />
            <input
              aria-label={t('Szukaj osoby')}
              placeholder={t('Odszukaj bliską osobę…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-btn"
                aria-label={t('Wyczyść wyszukiwanie')}
                onClick={() => setQuery('')}
              >
                <X size={15} />
              </button>
            )}
            {query && (
              <div className="search-results">
                {results.length ? (
                  results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFocusId(null);
                        setTimeout(() => setFocusId(p.id), 0);
                        setQuery('');
                      }}
                    >
                      <Portrait variant={p.portrait} name={p.firstName} />
                      <span>
                        {p.firstName} {familyName(p)}
                        <small>{p.birth}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="no-results">
                    {t('Nie znaleziono osoby.')}
                    <br />
                    <button className="btn text" onClick={() => setQuery('')}>
                      {t('Wyczyść wyszukiwanie')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="toolbar-right">
            <div className="segmented small">
              <button
                className={!manual ? 'active' : ''}
                onClick={() => setManual(false)}
              >
                <LayoutGrid size={15} />
                {t('Automatyczny')}
              </button>
              <button
                className={manual ? 'active' : ''}
                onClick={() => setManual(true)}
              >
                <Hand size={15} />
                {t('Ręczny')}
              </button>
            </div>
            <span className="toolbar-divider" />
            <button
              className={`portrait-toggle ${portraits ? 'active' : ''}`}
              aria-pressed={portraits}
              onClick={() => setPortraits(!portraits)}
            >
              {portraits ? <Image size={17} /> : <ImageOff size={17} />}
              <span>
                {portraits ? t('Portrety włączone') : t('Bez portretów')}
              </span>
            </button>
          </div>
        </div>
        <FamilyCanvas
          treeId={tree.id}
          people={tree.people}
          connections={connections}
          portraits={portraits}
          manual={manual}
          onDisplayMode={(nextManual, nextPortraits) => {
            setManual(nextManual);
            setPortraits(nextPortraits);
          }}
          onSelect={onPerson}
          onNew={onNew}
          onRelation={onRelation}
          revealRequest={revealRequest}

          focusId={focusId}
        />
      </div>
      {view === 'families' && (
        <FamiliesPage
          tree={tree}
          onPerson={onPerson}
          onSave={onSaveFamilies}
          onTree={(id) => {
            setView('tree');
            setFocusId(null);
            setTimeout(() => setFocusId(id), 0);
          }}
        />
      )}
      {view === 'map' && (
        <Suspense
          fallback={
            <div role="status" className="empty-state">
              {t('Wczytywanie mapy…')}
            </div>
          }
        >
          <BirthMapPage
            people={tree.people}
            onPerson={onPerson}
            onTree={(id) => {
              setView('tree');
              setFocusId(null);
              setTimeout(() => setFocusId(id), 0);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
