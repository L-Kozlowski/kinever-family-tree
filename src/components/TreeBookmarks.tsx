import { Bookmark, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { t, useLanguage } from '../i18n';
import type { TreeBookmark } from '../mocks/treeBookmarks';

const palette = [
  { value: '#795436', label: 'Brązowy' },
  { value: '#526845', label: 'Zielony' },
  { value: '#3c6577', label: 'Niebieski' },
  { value: '#94503c', label: 'Ceglasty' },
  { value: '#754d76', label: 'Śliwkowy' },
  { value: '#956916', label: 'Złoty' },
] as const;
const defaultColor = palette[0].value;

export function TreeBookmarks({
  bookmarks,
  onSave,
  onOpen,
  onRemove,
}: {
  bookmarks: TreeBookmark[];
  onSave: (name: string, color: string) => void;
  onOpen: (bookmark: TreeBookmark) => void;
  onRemove: (id: string) => void;
}) {
  useLanguage();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(defaultColor);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [open]);

  useEffect(() => {
    if (adding) nameInput.current?.focus();
  }, [adding]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    setAdding(false);
    if (restoreFocus) toggle.current?.focus();
  };

  const finishAdding = () => {
    setAdding(false);
    requestAnimationFrame(() => add.current?.focus());
  };

  return (
    <div
      ref={root}
      className="tree-bookmarks"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={toggle}
        className="icon-btn"
        type="button"
        title={t('Zakładki drzewa')}
        aria-label={t('Zakładki drzewa')}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Bookmark size={18} />
      </button>
      {open && (
        <section
          id={panelId}
          className="bookmark-panel"
          aria-labelledby={panelId + '-title'}
        >
          <h3 id={panelId + '-title'}>{t('Zakładki drzewa')}</h3>
          {bookmarks.length ? (
            <ul>
              {bookmarks.map((bookmark) => {
                const marker = palette.find(
                  (entry) => entry.value === bookmark.color,
                );
                return (
                  <li key={bookmark.id}>
                    <button
                      className="bookmark-open"
                      type="button"
                      onClick={() => {
                        onOpen(bookmark);
                        close(true);
                      }}
                    >
                      <Bookmark
                        size={17}
                        color={marker?.value ?? defaultColor}
                        fill={marker?.value ?? defaultColor}
                        aria-hidden="true"
                      />
                      <span>{bookmark.name}</span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-btn bookmark-delete"
                      type="button"
                      aria-label={t('Usuń zakładkę: {0}', bookmark.name)}
                      title={t('Usuń zakładkę: {0}', bookmark.name)}
                      onClick={() => onRemove(bookmark.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>{t('Brak zapisanych widoków.')}</p>
          )}
          <div className="bookmark-panel-footer">
            {adding ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim()) return;
                  onSave(name.trim(), color);
                  finishAdding();
                }}
              >
                <label>
                  {t('Nazwa zakładki')}
                  <input
                    ref={nameInput}
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <fieldset className="bookmark-palette">
                  <legend>{t('Kolor zakładki')}</legend>
                  {palette.map((entry) => (
                    <label key={entry.value} title={t(entry.label)}>
                      <input
                        name={panelId + '-color'}
                        type="radio"
                        value={entry.value}
                        checked={entry.value === color}
                        aria-label={t(entry.label)}
                        onChange={() => setColor(entry.value)}
                      />
                      <span style={{ backgroundColor: entry.value }} />
                    </label>
                  ))}
                </fieldset>
                <div className="bookmark-form-actions">
                  <button
                    className="btn text"
                    type="button"
                    onClick={finishAdding}
                  >
                    {t('Anuluj')}
                  </button>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={!name.trim()}
                  >
                    {t('Zapisz widok')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                ref={add}
                className="btn secondary bookmark-add"
                type="button"
                onClick={() => {
                  setName('');
                  setColor(defaultColor);
                  setAdding(true);
                }}
              >
                <Plus size={16} />
                {t('Dodaj zakładkę')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
