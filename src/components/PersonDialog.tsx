import { displayGivenName, fullName, t, useLanguage } from '../i18n';
import { SurnameInput } from './SurnameInput';
import { LocationEditor } from './LocationEditor';
import { deletionImpact } from '../mocks/deletion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Check,
  ArrowRight,
  ImageOff,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  Person,
  RelationKind,
  DemoConnection,
  SurnameFamily,
} from '../types';

import { FamilyRelations } from './FamilyRelations';
import { Modal } from './ui';
import { Portrait } from './Portrait';
import { uploadMedia } from '../services/api';

type Props = {
  surnameFamilies?: SurnameFamily[];
  person: Person;
  people: Person[];
  connections: DemoConnection[];
  onClose: () => void;
  onSave: (p: Person) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onDetach: (ids: string[]) => Promise<boolean>;
  onRelation: (kind: RelationKind) => void;
  onSelect: (p: Person) => void;
  isNew?: boolean;
};
export function PersonDialog({
  surnameFamilies,
  person,
  people,
  connections,
  onClose,
  onSave,
  onDelete,
  onDetach,
  onRelation,
  onSelect,
  isNew = false,
}: Props) {
  useLanguage();
  const [largeView, setLargeView] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState(person);
  const [unknownSurname, setUnknownSurname] = useState(
    !isNew && !person.lastName.trim(),
  );
  useEffect(() => {
    setDraft(person);
    setUnknownSurname(!isNew && !person.lastName.trim());
  }, [person, isNew]);
  const [tab, setTab] = useState('Informacje');
  const [discard, setDiscard] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [remove, setRemove] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoOptions, setPhotoOptions] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveAndClose = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const deletionBlocked = deletionImpact(people, connections, person.id);
  const dirty =
    JSON.stringify(person) !== JSON.stringify(draft) ||
    unknownSurname !== (!isNew && !person.lastName.trim());
  const close = () => {
    if (busy) return;
    if (editing && dirty) {
      setPendingClose(true);
      setDiscard(true);
    } else onClose();
  };
  const changeMode = () => {
    if (busy) return;
    if (editing && dirty) {
      setPendingClose(false);
      setDiscard(true);
      return;
    }
    setEditing(!editing);
  };
  const update = (key: keyof Person, value: string) =>
    setDraft((p) => ({ ...p, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (
      !draft.firstName.trim() ||
      (!draft.isPlaceholder && !unknownSurname && !draft.lastName.trim())
    ) {
      setTab('Informacje');
      setPhotoError(
        t(
          'Uzupełnij imiona i nazwisko lub zaznacz, że nazwisko jest nieznane.',
        ),
      );
      return;
    }
    setPhotoError('');
    setBusy(true);
    const saved = await onSave({
      ...draft,
      lastName: unknownSurname ? '' : draft.lastName.trim(),
      familiarName: draft.familiarName?.trim() || undefined,
    });
    setBusy(false);
    if (saved) {
      setEditing(false);
      if (saveAndClose.current) onClose();
    }
    saveAndClose.current = false;
    if (!saved)
      setPhotoError(
        t(
          'Nie udało się zapisać. Dane pozostały w formularzu — sprawdź komunikat i ponów zapis.',
        ),
      );
  };
  return (
    <Modal
      title={isNew ? t('Nowa osoba') : fullName(person)}
      eyebrow={t('RODZINNY ALBUM · PROFIL OSOBY')}
      onClose={close}
      wide
      className={`person-profile ${largeView ? 'profile-large' : 'profile-compact'} ${editing ? 'profile-editing' : ''}`}
      headerActions={
        <button
          type="button"
          className="profile-size-toggle"
          aria-pressed={largeView}
          aria-label={
            largeView
              ? t('Włącz widok kompaktowy')
              : t('Powiększ tekst profilu')
          }
          title={
            largeView ? t('Widok kompaktowy') : t('Większy tekst i odstępy')
          }
          onClick={() => setLargeView(!largeView)}
        >
          {largeView ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
          <span>{largeView ? t('Kompaktowy') : t('Powiększ')}</span>
        </button>
      }
    >
      <div className="profile-mode">
        <span>
          {editing ? (
            <>
              <Pencil size={15} />
              {t('Edytujesz dane osoby')}
            </>
          ) : (
            <>
              <ImageOff size={15} />
              {t('Podgląd informacji')}
            </>
          )}
        </span>
        <div className="profile-actions">
          <label className="switch-label">
            {t('Tryb edycji')}
            <button
              type="button"
              role="switch"
              aria-checked={editing}
              aria-label={t('Tryb edycji')}
              disabled={busy}
              className={`switch ${editing ? 'on' : ''}`}
              onClick={changeMode}
            >
              <span />
            </button>
          </label>
          {!isNew && (
            <button
              type="button"
              className="icon-btn delete"
              aria-label={t('Usuń osobę')}
              title={t('Usuń osobę')}
              disabled={busy}
              onClick={() => {
                setDeleteError('');
                setRemove(true);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {remove && (
        <Modal
          title={
            deletionBlocked.length
              ? t('Nie można usunąć osoby')
              : t('Potwierdź usunięcie osoby')
          }
          onClose={() => {
            if (!busy) setRemove(false);
          }}
        >
          <div className="form-stack delete-confirmation">
            <p>
              {deletionBlocked.length
                ? t(
                    'Usunięcie tej osoby pozostawiłoby kogoś bez połączeń lub rozdzieliłoby rodzinę. Najpierw uzupełnij połączenia.',
                  )
                : t(
                    'Czy na pewno usunąć {0} i wszystkie jej połączenia?',
                    fullName(person),
                  )}
            </p>
            {deletionBlocked.length > 0 && (
              <p>
                {t('Najbliższe osoby:')}{' '}
                {people
                  .filter((p) => deletionBlocked.includes(p.id))
                  .map(fullName)
                  .join(', ')}
                .
              </p>
            )}
            {!deletionBlocked.length && (
              <p>
                {t('Tej operacji nie można cofnąć w interfejsie.')}
                {dirty
                  ? t(' Niezapisane zmiany tej osoby zostaną odrzucone.')
                  : ''}
              </p>
            )}
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              {deletionBlocked.length ? t('Wróć do profilu') : t('Anuluj')}
            </button>
            {!deletionBlocked.length && (
              <button
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (!(await onDelete()))
                      setDeleteError(
                        t(
                          'Nie usunięto osoby. Sprawdź połączenie z serwerem; jeśli dane zmieniono w innym oknie, odśwież album przed kolejną próbą.',
                        ),
                      );
                  } catch (error) {
                    setDeleteError(
                      error instanceof Error
                        ? error.message
                        : t('Nie udało się usunąć osoby.'),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('Tak, usuń osobę')}
              </button>
            )}
          </div>
        </Modal>
      )}
      {discard ? (
        <div className="inline-confirm" role="alert">
          <h3>{t('Odrzucić niezapisane zmiany?')}</h3>
          <p>{t('Wprowadzone zmiany nie zostały jeszcze zastosowane.')}</p>
          <div className="button-row">
            <button className="btn secondary" onClick={() => setDiscard(false)}>
              {t('Wróć do edycji')}
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                setDiscard(false);
                requestAnimationFrame(() => {
                  if (formRef.current?.reportValidity()) {
                    saveAndClose.current = pendingClose;
                    formRef.current.requestSubmit();
                  }
                });
              }}
            >
              {t('Zapisz zmiany')}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setDraft(person);
                setUnknownSurname(!isNew && !person.lastName.trim());
                setEditing(false);
                setDiscard(false);
                if (isNew || pendingClose) onClose();
              }}
            >
              {t('Odrzuć zmiany')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="profile-body" hidden={discard}>
        <div className="profile-intro">
          <div className="profile-photo">
            <Portrait
              variant={draft.portrait}
              name={draft.firstName}
              photo={draft.photo}
              unknown={draft.isPlaceholder && !draft.customPortrait}
            />
            {editing && (
              <button
                aria-label={t('Zmień portret')}
                className="photo-upload"
                type="button"
                disabled={busy}
                aria-expanded={photoOptions}
                onClick={() => setPhotoOptions((value) => !value)}
              >
                <Upload size={16} />
              </button>
            )}
          </div>
          <div>
            <span className="eyebrow">{t('CZĘŚĆ NASZEJ HISTORII')}</span>
            <h3>{draft.firstName ? fullName(draft) : t('Nowa osoba')}</h3>
            <p>
              <CalendarDays size={15} />
              {draft.birth || t('Nieznana data urodzenia')}
              {draft.death ? ` — ${draft.death}` : ''}
            </p>
            <p>
              <MapPin size={15} />
              {draft.birthPlace || t('Nieznane miejsce')}
            </p>
          </div>
          <input
            type="file"
            ref={fileRef}
            hidden
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const media = await uploadMedia(file);
                update('photo', media.url);
                setPhotoError('');
              } catch (error) {
                setPhotoError(
                  error instanceof Error
                    ? error.message
                    : t('Nie udało się dodać zdjęcia.'),
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
        {editing && photoOptions && (
          <section
            className="portrait-picker"
            aria-label={t('Wybór zdjęcia lub portretu')}
          >
            <div className="portrait-picker-heading">
              <h4>{t('Zdjęcie lub portret')}</h4>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} />
                {draft.photo
                  ? t('Zmień własne zdjęcie')
                  : t('Dodaj własne zdjęcie')}
              </button>
            </div>
            {draft.photo ? (
              <div>
                <p>
                  {t(
                    'Wyświetlane jest Twoje zdjęcie. Aby wybrać ilustrację, odłącz zdjęcie od profilu.',
                  )}
                </p>
                <button
                  type="button"
                  className="btn text"
                  disabled={busy}
                  onClick={() => setDraft((p) => ({ ...p, photo: undefined }))}
                >
                  {t('Usuń własne zdjęcie z profilu')}
                </button>
              </div>
            ) : (
              <>
                <p>
                  {t(
                    'Wybierz jeden z dostępnych portretów. Wybór zapisze się po naciśnięciu „Zapisz zmiany”.',
                  )}
                </p>
                <div
                  className="portrait-options"
                  role="radiogroup"
                  aria-label={t('Dostępne portrety')}
                >
                  {[
                    t('Starszy mężczyzna'),
                    t('Starsza kobieta'),
                    t('Mężczyzna'),
                    t('Kobieta'),
                    t('Blondyn'),
                    t('Blondynka'),
                  ].map((label, variant) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={
                        draft.portrait === variant &&
                        (!draft.isPlaceholder || !!draft.customPortrait)
                      }
                      aria-label={label}
                      key={variant}
                      disabled={busy}
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          portrait: variant,
                          customPortrait: true,
                        }))
                      }
                    >
                      <Portrait variant={variant} name={label} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {photoError && (
          <p className="form-error" role="alert">
            {photoError}
          </p>
        )}
        <div className="tabs" role="tablist" aria-label={t('Dane osoby')}>
          {['Informacje', 'Rodzina', 'Notatki'].map((tabName) => (
            <button
              key={tabName}
              role="tab"
              aria-selected={tab === tabName}
              className={tab === tabName ? 'active' : ''}
              onClick={() => setTab(tabName)}
            >
              {t(tabName)}
            </button>
          ))}
        </div>
        <form className="profile-form" ref={formRef} onSubmit={submit}>
          {tab === 'Informacje' && (
            <div className="form-grid">
              {(
                [
                  ['firstName', t('Imiona')],
                  ['familiarName', t('Imię wołane')],
                  ['lastName', t('Nazwisko')],
                  ['maidenName', t('Nazwisko rodowe')],
                  ['birth', t('Data urodzenia')],
                  ['death', t('Data śmierci')],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  {editing ? (
                    key === 'lastName' || key === 'maidenName' ? (
                      <SurnameInput
                        aria-label={label}
                        people={people}
                        families={surnameFamilies}
                        value={
                          key === 'lastName' && unknownSurname ? '' : draft[key]
                        }
                        onValueChange={(value) => update(key, value)}
                        required={
                          key === 'lastName' &&
                          !draft.isPlaceholder &&
                          !unknownSurname
                        }
                        disabled={key === 'lastName' && unknownSurname}
                        placeholder={t('Uzupełnij informacje')}
                      />
                    ) : (
                      <input
                        value={draft[key] ?? ''}
                        onChange={(e) => update(key, e.target.value)}
                        required={key === 'firstName'}
                        maxLength={key === 'familiarName' ? 500 : undefined}
                        placeholder={
                          key === 'birth' || key === 'death'
                            ? t('np. ok. 1956 lub 12.05.1956')
                            : t('Uzupełnij informacje')
                        }
                      />
                    )
                  ) : (
                    <span className="read-value">
                      {(key === 'firstName'
                        ? displayGivenName(draft)
                        : draft[key]
                      )?.trim() ||
                        (key === 'lastName'
                          ? t('Nieznane nazwisko')
                          : t('Nie podano'))}
                    </span>
                  )}
                </label>
              ))}
              {editing && (
                <label className="unknown-surname-option">
                  <input
                    type="checkbox"
                    checked={unknownSurname}
                    onChange={(event) =>
                      setUnknownSurname(event.target.checked)
                    }
                  />
                  {t('Nieznane nazwisko')}
                </label>
              )}
              <label>
                {t('Płeć (opcjonalnie)')}
                {editing ? (
                  <select
                    value={draft.gender || ''}
                    onChange={(e) => update('gender', e.target.value)}
                  >
                    <option value="">{t('Nie podano')}</option>
                    <option value="Kobieta">{t('Kobieta')}</option>
                    <option value="Mężczyzna">{t('Mężczyzna')}</option>
                    <option value="Inna">{t('Inna')}</option>
                  </select>
                ) : (
                  <span className="read-value">
                    {t(draft.gender || 'Nie podano')}
                  </span>
                )}
              </label>
              <LocationEditor
                label={t('Miejsce urodzenia')}
                name={draft.birthPlace}
                location={draft.birthLocation}
                editing={editing}
                compact={!largeView}
                onChange={(name, location) =>
                  setDraft((p) => ({
                    ...p,
                    birthPlace: name,
                    birthLocation: location,
                  }))
                }
              />
              <LocationEditor
                label={t('Miejsce zamieszkania')}
                name={draft.residence}
                location={draft.residenceLocation}
                editing={editing}
                compact={!largeView}
                onChange={(name, location) =>
                  setDraft((p) => ({
                    ...p,
                    residence: name,
                    residenceLocation: location,
                  }))
                }
              />
              <div className="field-hint">
                {t(
                  'Daty mogą być niepełne. Brak daty śmierci nie określa statusu życia osoby.',
                )}
              </div>
            </div>
          )}
          {tab === 'Rodzina' && (
            <div className="family-tab">
              <FamilyRelations
                person={person}
                people={people}
                connections={connections}
                onAdd={
                  isNew
                    ? undefined
                    : (kind) => {
                        if (editing && dirty) {
                          setDiscard(true);
                          return;
                        }
                        onRelation(kind);
                      }
                }
                onDetach={isNew ? undefined : onDetach}
                onSelect={(relative) => {
                  if (editing && dirty) {
                    setDiscard(true);
                    return;
                  }
                  onSelect(relative);
                }}
              />
            </div>
          )}
          {tab === 'Notatki' && (
            <div className="notes-tab">
              <label>
                {t('Wspomnienia i dodatkowe informacje')}
                {editing ? (
                  <textarea
                    rows={largeView ? 7 : 3}
                    value={draft.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder={t('Zapisz rodzinną historię…')}
                  />
                ) : (
                  <p className="read-notes">
                    {draft.notes || t('Nie dodano jeszcze wspomnień.')}
                  </p>
                )}
              </label>
              <section
                className="attachment-section"
                aria-label={t('Zdjęcia i dokumenty w notatkach')}
              >
                <h3>{t('Zdjęcia i dokumenty')}</h3>
                {(draft.attachments || []).map((attachment) => (
                  <div className="attachment-card" key={attachment.id}>
                    {attachment.mime.startsWith('image/') && (
                      <img
                        src={attachment.url}
                        alt={attachment.caption || attachment.name}
                        loading="lazy"
                      />
                    )}
                    <div>
                      <a href={attachment.url + '?download=true'}>
                        {attachment.name}
                      </a>
                      <small>{Math.ceil(attachment.size / 1024)} KB</small>
                      {editing ? (
                        <input
                          aria-label={t('Opis: {0}', attachment.name)}
                          placeholder={t('Opis dokumentu lub zdjęcia')}
                          value={attachment.caption || ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              attachments: (p.attachments || []).map((a) =>
                                a.id === attachment.id
                                  ? { ...a, caption: e.target.value }
                                  : a,
                              ),
                            }))
                          }
                        />
                      ) : (
                        <p>{attachment.caption}</p>
                      )}
                    </div>
                    {editing && (
                      <button
                        type="button"
                        className="icon-btn delete"
                        aria-label={t('Odłącz: {0}', attachment.name)}
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            attachments: (p.attachments || []).filter(
                              (a) => a.id !== attachment.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {!draft.attachments?.length && (
                  <p>{t('Brak załączników do notatek.')}</p>
                )}
                {editing && (
                  <label className="attachment-upload">
                    {t('Dodaj zdjęcia lub dokumenty (do 20 MB na plik)')}
                    <input
                      type="file"
                      multiple
                      disabled={busy}
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = '';
                        setBusy(true);
                        try {
                          for (const file of files) {
                            const media = await uploadMedia(file);
                            setDraft((p) => ({
                              ...p,
                              attachments: [...(p.attachments || []), media],
                            }));
                          }
                          setPhotoError('');
                        } catch (error) {
                          setPhotoError(
                            error instanceof Error
                              ? error.message
                              : t('Błąd wysyłania pliku.'),
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                )}
              </section>
            </div>
          )}
          <div className="modal-footer">
            <span className="subtle">
              {t('Lokalna baza danych · zdjęcia i dokumenty na tym komputerze')}
            </span>
            <div className="button-row">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => {
                      setDraft(person);
                      setUnknownSurname(!isNew && !person.lastName.trim());
                      setEditing(false);
                      if (isNew) onClose();
                    }}
                  >
                    {t('Anuluj')}
                  </button>
                  <button type="submit" disabled={busy} className="btn primary">
                    <Check size={16} />
                    {busy ? t('Zapisywanie…') : t('Zapisz zmiany')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={close}
                  >
                    {t('Zamknij')}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
