import { useState } from 'react';
import { ArrowRight, Link2Off, Plus } from 'lucide-react';
import type { Person, DemoConnection, RelationKind } from '../types';
import { isParent, relativesOf } from '../mocks/familyView';
import { fullName, t, useLanguage } from '../i18n';
import { Portrait } from './Portrait';

export function FamilyRelations({
  person,
  people,
  connections,
  onSelect,
  onDetach,
  onAdd,
}: {
  person: Person;
  people: Person[];
  connections: DemoConnection[];
  onSelect: (person: Person) => void;
  onDetach?: (ids: string[]) => Promise<boolean>;
  onAdd?: (kind: RelationKind) => void;
}) {
  useLanguage();
  const [pending, setPending] = useState<{ relative: Person; kind: string }>();
  const [siblingSide, setSiblingSide] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = pending ? fullName(pending.relative) : '';
  const sharedParents = new Set(
    connections
      .filter((link) => isParent(link) && link.target === person.id)
      .map((link) => link.source)
      .filter((id) =>
        connections.some(
          (link) =>
            isParent(link) &&
            link.source === id &&
            link.target === pending?.relative.id,
        ),
      ),
  );
  const links = pending
    ? connections.filter((link) => {
        const other = pending.relative.id;
        switch (pending.kind) {
          case 'parent':
            return (
              isParent(link) &&
              link.source === other &&
              link.target === person.id
            );
          case 'child':
            return (
              isParent(link) &&
              link.source === person.id &&
              link.target === other
            );
          case 'partner':
            return (
              link.kind === 'partner' &&
              ((link.source === person.id && link.target === other) ||
                (link.source === other && link.target === person.id))
            );
          case 'sibling':
            return (
              isParent(link) &&
              sharedParents.has(link.source) &&
              link.target === siblingSide
            );
          default:
            return false;
        }
      })
    : [];

  return (
    <div className="family-sections">
      {pending && (
        <div
          className="inline-confirm"
          role="group"
          aria-labelledby="detach-heading"
        >
          <h3 id="detach-heading">{t('Odpiąć relację z osobą {0}?', name)}</h3>
          <p>{t('Obie osoby pozostaną w drzewie.')}</p>
          {pending.kind === 'sibling' && (
            <label>
              {t(
                'Rodzeństwo wynika ze wspólnych rodziców. Wybierz, komu odpiąć poniższe połączenia z rodzicami.',
              )}
              <select
                value={siblingSide}
                onChange={(event) => setSiblingSide(event.target.value)}
                disabled={busy}
              >
                <option value="">{t('Wybierz osobę')}</option>
                <option value={person.id}>{fullName(person)}</option>
                <option value={pending.relative.id}>{name}</option>
              </select>
              <span>
                {people
                  .filter((parent) => sharedParents.has(parent.id))
                  .map(fullName)
                  .join(', ')}
              </span>
            </label>
          )}
          {failed && (
            <p role="alert">
              {t('Nie udało się odpiąć relacji. Spróbuj ponownie.')}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => setPending(undefined)}
            >
              {t('Anuluj')}
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy || !links.length}
              onClick={async () => {
                if (!onDetach) return;
                setBusy(true);
                setFailed(false);
                try {
                  if (await onDetach(links.map((link) => link.id)))
                    setPending(undefined);
                  else setFailed(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Odepnij relację')}
            </button>
          </div>
        </div>
      )}
      {relativesOf(person, people, connections).map((section) => {
        const action = {
          parent: ['parent', 'Dodaj rodzica'],
          partner: ['partner', 'Dodaj partnera'],
          sibling: ['sibling', 'Dodaj rodzeństwo'],
          child: ['child', 'Dodaj dziecko'],
        } as const;
        const [kind, label] = action[section.kind];
        return (
          <section key={section.kind} className="family-section">
            <h4>
              {t(section.title)}
              <span>{section.people.length}</span>
            </h4>
            {section.people.length ? (
              <div className="relative-list">
                {section.people.map((relative) => (
                  <div className="relative-row" key={relative.id}>
                    <button
                      className="relative-profile"
                      type="button"
                      onClick={() => onSelect(relative)}
                    >
                      <Portrait
                        variant={relative.portrait}
                        name={fullName(relative)}
                        photo={relative.photo}
                        unknown={
                          relative.isPlaceholder && !relative.customPortrait
                        }
                      />
                      <span>
                        {fullName(relative)}
                        <small>
                          {relative.birth || t('Nieznana data')}
                          {relative.maidenName &&
                          relative.maidenName !== relative.lastName
                            ? t(' · obecnie {0}', relative.lastName)
                            : ''}
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                    {onDetach && (
                      <button
                        className="icon-btn detach-relative"
                        type="button"
                        disabled={busy}
                        title={t(
                          'Odepnij relację z osobą {0}',
                          fullName(relative),
                        )}
                        aria-label={t(
                          'Odepnij relację z osobą {0}',
                          fullName(relative),
                        )}
                        onClick={(event) => {
                          setSiblingSide('');
                          setFailed(false);
                          setPending({ relative, kind: section.kind });
                          const panel =
                            event.currentTarget.closest('.family-sections');
                          requestAnimationFrame(() => {
                            panel
                              ?.querySelector('#detach-heading')
                              ?.scrollIntoView({ block: 'nearest' });
                            panel
                              ?.querySelector<HTMLButtonElement>(
                                '.inline-confirm button',
                              )
                              ?.focus({ preventScroll: true });
                          });
                        }}
                      >
                        <Link2Off size={17} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-family-section">
                {t('Nie dodano osób w tej kategorii.')}
              </p>
            )}
            {onAdd && (
              <button
                className="btn secondary family-section-add"
                type="button"
                onClick={() => onAdd(kind)}
              >
                <Plus size={15} />
                {t(label)}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
