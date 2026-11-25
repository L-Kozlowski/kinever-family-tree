import { setLanguage, t, useLanguage } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FamilyTree } from '../types';
import {
  Library,
  GitBranch,
  ArrowUpRight,
  Leaf,
  CircleHelp,
  FolderOpen,
  Download,
  Languages,
} from 'lucide-react';
import { request } from '../services/api';
import { Brand } from '../components/ui';

export function AppLayout({
  children,
  openTrees,
  activeId,
  onOpen,
  onCloseTree,
  onHome,
  onHelp,
}: {
  children: ReactNode;
  openTrees: FamilyTree[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onCloseTree: (id: string) => void;
  onHome: () => void;
  onHelp: () => void;
}) {
  const language = useLanguage();
  const languageSave = useRef(Promise.resolve());
  const changeLanguage = (value: 'pl' | 'en') => {
    setLanguage(value);
    languageSave.current = languageSave.current
      .then(async () => {
        await request('/api/preferences/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: value }),
        });
      })
      .catch(() => {});
  };
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [databaseError, setDatabaseError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', escape);
    };
  }, [menu]);
  return (
    <div className="app">
      <aside className="sidebar">
        <button
          className="brand-button"
          onClick={onHome}
          aria-label={t('KinEver — moje drzewa')}
        >
          <Brand />
        </button>
        <div className="nav-caption">{t('TWOJA PRZESTRZEŃ')}</div>
        <nav>
          <button
            className={!activeId ? 'nav-item active' : 'nav-item'}
            onClick={onHome}
          >
            <Library size={19} />
            {t('Moje drzewa')}
            {!activeId && <span className="nav-point" />}
          </button>
          {openTrees.map((tree) => (
            <button
              key={tree.id}
              className={`nav-item family-tab-link ${activeId === tree.id ? 'active' : ''}`}
              aria-label={t('Otwórz rodzinę: {0}', tree.name)}
              aria-current={activeId === tree.id ? 'page' : undefined}
              title={tree.name}
              onClick={() => onOpen(tree.id)}
              onMouseDown={(e) => {
                if (e.button === 1) e.preventDefault();
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onCloseTree(tree.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({
                  id: tree.id,
                  x: Math.min(e.clientX, window.innerWidth - 210),
                  y: Math.min(e.clientY, window.innerHeight - 55),
                });
              }}
            >
              <GitBranch size={19} />
              <span>{tree.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-story">
          <Leaf size={25} />
          <p>
            {t('Każda rodzina')}
            <br />
            {t('ma swoją historię.')}
          </p>
          <span>
            {t('Daj jej miejsce,')}
            <br />
            {t('w którym zapuści korzenie.')}
          </span>
          <div className="story-line" />
        </div>
        <div className="sidebar-bottom">
          <label className="language-selector">
            <Languages size={17} aria-hidden="true" />
            <select
              aria-label={t('Język aplikacji')}
              value={language}
              onChange={(event) =>
                changeLanguage(event.target.value === 'en' ? 'en' : 'pl')
              }
            >
              <option value="pl" lang="pl">
                Polski
              </option>
              <option value="en" lang="en">
                English
              </option>
            </select>
          </label>
          <button className="nav-item" onClick={onHelp}>
            <CircleHelp size={18} />
            {t('Jak korzystać')}
            <ArrowUpRight size={14} />
          </button>
          <div
            className="database-location"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDatabaseOpen(false);
                event.currentTarget.querySelector('button')?.focus();
              }
            }}
          >
            <button
              className="demo-badge database-toggle"
              type="button"
              aria-expanded={databaseOpen}
              aria-controls="database-location-actions"
              aria-label={t('Lokalny album rodzinny')}
              title={t('Lokalny album rodzinny')}
              onClick={() => {
                setDatabaseError('');
                setDatabaseOpen(!databaseOpen);
              }}
            >
              <FolderOpen size={16} />
              <span className="database-caption">
                {t('Lokalny album rodzinny')}
                <small>{t('SQLite · pliki na tym komputerze')}</small>
              </span>
            </button>
            <div
              id="database-location-actions"
              className="database-location-actions"
              hidden={!databaseOpen}
            >
              <button
                type="button"
                onClick={async () => {
                  try {
                    await request('/api/database/reveal', {
                      method: 'POST',
                      headers: { 'X-Korzenie-Action': 'reveal-database' },
                    });
                    setDatabaseOpen(false);
                  } catch (error) {
                    setDatabaseError(
                      error instanceof Error
                        ? error.message
                        : t('Nie udało się otworzyć folderu.'),
                    );
                  }
                }}
              >
                <FolderOpen size={15} />
                {t('Otwórz lokalizację pliku bazy danych')}
              </button>
              <a href="/api/backup">
                <Download size={15} />
                {t('Pobierz pełną kopię bazy i plików')}
              </a>
              {databaseError && <p role="alert">{t(databaseError)}</p>}
            </div>
          </div>
        </div>
      </aside>
      {menu && (
        <div
          className="family-tab-menu"
          role="menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            role="menuitem"
            onClick={() => {
              onCloseTree(menu.id);
              setMenu(null);
            }}
          >
            {t('Zamknij zakładkę rodziny')}
          </button>
        </div>
      )}
      <main className="main">{children}</main>
    </div>
  );
}
