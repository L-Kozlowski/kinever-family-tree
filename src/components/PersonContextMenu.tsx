import { fullName, t, useLanguage } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  UserPlus,
  ContactRound,
  ArrowLeft,
  House,
} from 'lucide-react';
import type { Person, RelationKind } from '../types';

export function PersonContextMenu({
  person,
  x,
  y,
  onClose,
  onAdd,
  onDetails,
  onSetHome,
  isHome,
}: {
  person: Person;
  x: number;
  y: number;
  onClose: () => void;
  onAdd: (kind: RelationKind) => void;
  onDetails: () => void;
  onSetHome: () => void;
  isHome: boolean;
}) {
  useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', onClose);
      previous?.focus();
    };
  }, [onClose]);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, [expanded]);
  return createPortal(
    <div
      ref={ref}
      className="person-context-menu"
      role="menu"
      aria-label={t('Opcje osoby: {0}', fullName(person))}
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 270)),
        top: Math.max(
          8,
          Math.min(y, window.innerHeight - (expanded ? 290 : 210)),
        ),
      }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const buttons = [...ref.current!.querySelectorAll('button')];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          buttons[
            (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      <div className="context-person-name">{fullName(person)}</div>
      {expanded ? (
        <>
          <button
            role="menuitem"
            className="context-back"
            onClick={() => setExpanded(false)}
          >
            <ArrowLeft size={14} />
            {t('Dodaj członka')}
          </button>
          {(['parent', 'sibling', 'partner', 'child'] as RelationKind[]).map(
            (kind) => (
              <button role="menuitem" key={kind} onClick={() => onAdd(kind)}>
                <UserPlus size={16} />
                {
                  {
                    parent: t('Rodzic'),
                    sibling: t('Brat / siostra'),
                    partner: t('Małżonek / partner'),
                    child: t('Dziecko'),
                  }[kind]
                }
              </button>
            ),
          )}
        </>
      ) : (
        <>
          <button
            role="menuitem"
            aria-expanded={expanded}
            onClick={() => setExpanded(true)}
          >
            <UserPlus size={17} />
            {t('Dodaj członka')}
            <ChevronRight size={15} />
          </button>
          <button role="menuitem" onClick={onDetails}>
            <ContactRound size={17} />
            {t('Szczegóły osoby')}
          </button>
          <button role="menuitem" onClick={onSetHome} disabled={isHome}>
            <House size={17} />
            {isHome ? t('Osoba startowa') : t('Ustaw jako osobę startową')}
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
