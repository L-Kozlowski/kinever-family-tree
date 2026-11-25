import { t, useLanguage } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AppLayout } from './layouts/AppLayout';
import { LibraryPage } from './pages/LibraryPage';
import { TreePage } from './pages/TreePage';
import { PersonDialog } from './components/PersonDialog';
import {
  ExportDialog,
  ImportDialog,
  NewTreeDialog,
} from './components/FlowDialogs';
import { RelationDialog } from './components/RelationDialog';
import { addRelative } from './mocks/addRelative';
import { Modal } from './components/ui';
import { loadState, persistState, type AppState } from './services/api';
import type { Person, RelationKind, RevealRelative } from './types';

type Dialog =
  'new-tree' | 'import' | 'export' | 'person' | 'relation' | 'help' | null;
export default function App() {
  useLanguage();
  const [state, setState] = useState<AppState | null>(null);
  const current = useRef<AppState | null>(null);
  const busy = useRef(false);
  const [loadingError, setLoadingError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  useEffect(() => {
    if (activeId)
      setOpenIds((ids) => (ids.includes(activeId) ? ids : [...ids, activeId]));
  }, [activeId]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [relationKind, setRelationKind] = useState<RelationKind>('parent');
  const [relationReturn, setRelationReturn] = useState<'canvas' | 'person'>(
    'canvas',
  );
  const [revealRequest, setRevealRequest] = useState<RevealRelative | null>(
    null,
  );
  const [toast, setToast] = useState('');
  const refresh = async () => {
    try {
      const result = await loadState();
      current.current = result;
      setState(result);
      setLoadingError('');
    } catch (error) {
      setLoadingError(String(error));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (busy.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const commit = async (next: AppState): Promise<boolean> => {
    if (busy.current) {
      setToast(t('Poczekaj na zakończenie poprzedniego zapisu.'));
      return false;
    }
    busy.current = true;
    setSaving(true);
    try {
      const { revision } = await persistState({
        ...next,
        revision: current.current!.revision,
      });
      const saved = { ...next, revision };
      current.current = saved;
      setState(saved);
      setToast(t('Zapisano w lokalnej bazie danych.'));
      return true;
    } catch (error) {
      setToast(
        t(
          'Nie zapisano: {0}',
          error instanceof Error ? error.message : String(error),
        ),
      );
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const tree = state?.trees.find((t) => t.id === activeId);
  const connections = state?.connectionsByTree[activeId || ''] || [];
  const close = () => {
    if (!busy.current) setDialog(null);
  };
  const openPerson = useCallback((person: Person) => {
    setSelected(person);
    setIsNew(false);
    setDialog('person');
  }, []);
  const openRelation = useCallback((person: Person, kind: RelationKind) => {
    setSelected(person);
    setRelationKind(kind);
    setRelationReturn('canvas');
    setDialog('relation');
  }, []);
  const save = async (person: Person) => {
    if (!state || !tree) return false;
    const updated = {
      ...person,
      isPlaceholder:
        !!person.isPlaceholder &&
        (!person.lastName.trim() || /^Nieznan/.test(person.firstName)),
    };
    const success = await commit({
      ...state,
      trees: state.trees.map((t) =>
        t.id !== tree.id
          ? t
          : {
              ...t,
              updated: new Date().toISOString(),
              people: isNew
                ? [...t.people, updated]
                : t.people.map((p) => (p.id === updated.id ? updated : p)),
            },
      ),
    });
    if (success) {
      setSelected(updated);
      setIsNew(false);
    }
    return success;
  };
  return (
    <AppLayout
      openTrees={(state?.trees || [])
        .filter((t) => openIds.includes(t.id))
        .sort((a, b) => openIds.indexOf(a.id) - openIds.indexOf(b.id))}
      activeId={activeId}
      onOpen={(id) => {
        if (!busy.current) {
          setDialog(null);
          setActiveId(id);
        }
      }}
      onCloseTree={(id) => {
        if (busy.current) return;
        setOpenIds((ids) => ids.filter((openId) => openId !== id));
        if (activeId === id) {
          setDialog(null);
          setActiveId(null);
        }
      }}
      onHome={() => {
        if (!busy.current) {
          setActiveId(null);
          setDialog(null);
        }
      }}
      onHelp={() => setDialog('help')}
    >
      {!state ? (
        <div className="empty-state">
          <h1>
            {loadingError
              ? t('Nie można otworzyć lokalnej bazy')
              : t('Otwieranie rodzinnego albumu…')}
          </h1>
          <p>{loadingError || t('Ładowanie danych z tego komputera.')}</p>
          {loadingError && (
            <button className="btn primary" onClick={() => void refresh()}>
              {t('Spróbuj ponownie')}
            </button>
          )}
        </div>
      ) : tree ? (
        <TreePage
          key={tree.id}
          tree={tree}
          connections={connections}
          onPerson={openPerson}
          onNew={() => {
            setSelected({
              id: crypto.randomUUID(),
              firstName: '',
              lastName: '',
              maidenName: '',
              birth: '',
              death: '',
              birthPlace: '',
              residence: '',
              notes: '',
              portrait: 2,
              attachments: [],
            });
            setIsNew(true);
            setDialog('person');
          }}
          onRelation={openRelation}
          revealRequest={revealRequest}
          onSaveFamilies={async (surnameFamilies) =>
            commit({
              ...state,
              trees: state.trees.map((t) =>
                t.id === tree.id
                  ? { ...t, surnameFamilies, updated: new Date().toISOString() }
                  : t,
              ),
            })
          }
          onExport={() => setDialog('export')}
        />
      ) : (
        <LibraryPage
          trees={state.trees}
          onOpen={setActiveId}
          onNew={() => setDialog('new-tree')}
          onImport={() => setDialog('import')}
        />
      )}
      {saving && (
        <div className="persistence-status" role="status">
          {t('Zapisywanie na tym komputerze…')}
        </div>
      )}
      {dialog === 'new-tree' && state && (
        <NewTreeDialog
          onClose={close}
          onCreate={async (name, description) => {
            const id = crypto.randomUUID();
            const success = await commit({
              ...state,
              trees: [
                ...state.trees,
                {
                  id,
                  name,
                  description,
                  people: [],
                  updated: new Date().toISOString(),
                },
              ],
              connectionsByTree: { ...state.connectionsByTree, [id]: [] },
            });
            if (success) {
              setActiveId(id);
              setDialog(null);
            }
            return success;
          }}
        />
      )}
      {dialog === 'import' && (
        <ImportDialog
          onClose={close}
          onDone={async (id) => {
            await refresh();
            setActiveId(id);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'export' && tree && (
        <ExportDialog
          treeId={tree.id}
          count={tree.people.length}
          onClose={close}
        />
      )}
      {dialog === 'person' && selected && tree && state && (
        <PersonDialog
          key={selected.id}
          surnameFamilies={tree.surnameFamilies}
          person={selected}
          people={tree.people}
          connections={connections}
          isNew={isNew}
          onClose={close}
          onSave={save}
          onSelect={openPerson}
          onRelation={(kind) => {
            setRelationKind(kind);
            setRelationReturn('person');
            setDialog('relation');
          }}
          onDelete={async () => {
            const success = await commit({
              ...state,
              trees: state.trees.map((t) =>
                t.id === tree.id
                  ? {
                      ...t,
                      people: t.people.filter((p) => p.id !== selected.id),
                    }
                  : t,
              ),
              connectionsByTree: {
                ...state.connectionsByTree,
                [tree.id]: connections.filter(
                  (c) => c.source !== selected.id && c.target !== selected.id,
                ),
              },
            });
            if (success) setDialog(null);
            return success;
          }}
          onDetach={(ids) =>
            commit({
              ...state,
              connectionsByTree: {
                ...state.connectionsByTree,
                [tree.id]: connections.filter((link) => !ids.includes(link.id)),
              },
            })
          }
        />
      )}
      {dialog === 'relation' && selected && tree && state && (
        <RelationDialog
          kind={relationKind}
          surnameFamilies={tree.surnameFamilies}
          person={selected}
          people={tree.people}
          connections={connections}
          onClose={() => {
            if (!busy.current)
              setDialog(relationReturn === 'person' ? 'person' : null);
          }}
          onDone={async (name, existingId, options) => {
            try {
              const result = addRelative(
                tree.people,
                connections,
                selected.id,
                relationKind,
                name,
                existingId,
                options,
              );
              const success = await commit({
                ...state,
                trees: state.trees.map((t) =>
                  t.id === tree.id ? { ...t, people: result.people } : t,
                ),
                connectionsByTree: {
                  ...state.connectionsByTree,
                  [tree.id]: result.connections,
                },
              });
              if (!success)
                return t(
                  'Nie udało się zapisać. Sprawdź komunikat i spróbuj ponownie.',
                );
              setRevealRequest({
                id: result.person.id,
                relativeTo: selected.id,
                kind: relationKind,
                token: crypto.randomUUID(),
              });
              setDialog(null);
            } catch (error) {
              return error instanceof Error
                ? t(error.message)
                : t('Nie udało się dodać osoby.');
            }
          }}
        />
      )}
      {dialog === 'help' && (
        <Modal
          title={t('Witaj w KinEver')}
          eyebrow={t('LOKALNY RODZINNY ALBUM')}
          onClose={close}
        >
          <div className="help-content">
            <p>
              {t(
                'Dane zapisują się w SQLite na tym komputerze. W profilu włącz tryb edycji, aby zmienić dane, zdjęcie lub załączniki do notatek.',
              )}
            </p>
            <ul>
              <li>
                {t(
                  'Przeciągaj tło i używaj kółka myszy do poruszania się po drzewie.',
                )}
              </li>
              <li>
                {t(
                  'Przyciski +/− otwierają i zwijają gałęzie. Strzałki przełączają partnerów i ich dzieci.',
                )}
              </li>
              <li>
                {t('Kliknij kartę prawym przyciskiem, aby dodać krewnego.')}
              </li>
              <li>{t('Wyszukiwarka odnajduje osobę na płótnie.')}</li>
              <li>
                {t(
                  'Eksport GEDCOM przenosi dane, a GEDZIP również zdjęcia i dokumenty.',
                )}
              </li>
            </ul>
            <p>
              {t(
                'Do odtworzenia kopii zatrzymaj serwer i rozpakuj archiwum do katalogu data/. Zachowaj poprzednią kopię danych.',
              )}
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn primary" onClick={close}>
              {t('Zamknij')}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            aria-label={t('Zamknij komunikat')}
            onClick={() => setToast('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AppLayout>
  );
}
