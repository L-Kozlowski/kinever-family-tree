import { fullName, t, useLanguage } from '../i18n';
import { SurnameInput } from './SurnameInput';
import { useState, type FormEvent } from 'react';
import { Plus, Users, Info } from 'lucide-react';
import type {
  Person,
  SurnameFamily,
  DemoConnection,
  RelationKind,
  DemoRelationOptions,
} from '../types';
import { relationContext } from '../mocks/addRelative';

import { Modal } from './ui';

export function RelationDialog({
  surnameFamilies,
  kind,
  person,
  people,
  connections,
  onClose,
  onDone,
}: {
  surnameFamilies?: SurnameFamily[];
  kind: RelationKind;
  person: Person;
  people: Person[];
  connections: DemoConnection[];
  onClose: () => void;
  onDone: (
    name: string,
    existingId?: string,
    options?: DemoRelationOptions,
  ) => Promise<string | void>;
}) {
  useLanguage();
  const context = relationContext(person, people, connections);
  const [mode, setMode] = useState('new');
  const [firstName, setFirstName] = useState('');
  const [familiarName, setFamiliarName] = useState('');
  const [unknownSurname, setUnknownSurname] = useState(false);
  const [details, setDetails] = useState({
    birth: '',
    death: '',
    birthPlace: '',
    residence: '',
  });
  const [lastName, setLastName] = useState(
    kind === 'partner' ? '' : context.surname,
  );
  const [existing, setExisting] = useState('');
  const [adopted, setAdopted] = useState(false);
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [parentIds, setParentIds] = useState([
    ...new Set(context.parents.map((parent) => parent.source)),
  ]);
  const [coParentId, setCoParentId] = useState(
    context.partners.length === 1
      ? context.partners[0].id
      : context.partners.length > 1
        ? '__choose__'
        : '',
  );
  const title = {
    parent: t('Dodaj rodzica'),
    child: t('Dodaj dziecko'),
    sibling: t('Dodaj rodzeństwo'),
    partner: t('Dodaj partnera'),
  }[kind];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (kind === 'child' && coParentId === '__choose__') {
      setError(t('Wybierz drugiego rodzica albo opcję „Tylko ten rodzic”.'));
      return;
    }
    if (busy) return;
    setBusy(true);
    const message = await onDone(
      `${firstName.trim()} ${lastName.trim()}`.trim(),
      mode === 'existing' ? existing : undefined,
      {
        parentIds,
        coParentId,
        adopted,
        gender,
        familiarName,
        profile:
          mode === 'new'
            ? {
                firstName,
                lastName: unknownSurname ? '' : lastName,
                ...details,
              }
            : undefined,
      },
    );
    setBusy(false);
    if (message) setError(message);
  };
  const secondParent = people.find((relative) => relative.id === coParentId);
  const existingChild = people.find((relative) => relative.id === existing);
  const childName =
    mode === 'existing'
      ? existingChild && fullName(existingChild)
      : [firstName.trim(), unknownSurname ? '' : lastName.trim()]
          .filter(Boolean)
          .join(' ');
  const nameWithDate = (relative: Person) =>
    [fullName(relative), relative.birth].filter(Boolean).join(' · ');
  return (
    <Modal
      title={title}
      eyebrow={t('RODZINA · {0}', fullName(person))}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        {t(
          'Połączenia uzupełnimy na podstawie informacji zapisanych w tym drzewie.',
        )}
      </p>
      <div className="segmented">
        <button
          className={mode === 'new' ? 'active' : ''}
          onClick={() => setMode('new')}
        >
          {t('Nowa osoba')}
        </button>
        <button
          className={mode === 'existing' ? 'active' : ''}
          onClick={() => setMode('existing')}
        >
          {t('Osoba z drzewa')}
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="form-stack">
          {mode === 'new' ? (
            <>
              <div className="relation-name-fields">
                <label>
                  {t('Imię')}
                  <input
                    autoFocus
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder={t('np. Adam')}
                  />
                </label>
                <label>
                  {t('Nazwisko')}
                  <SurnameInput
                    required={!unknownSurname}
                    disabled={unknownSurname}
                    aria-label={t('Nazwisko')}
                    people={people}
                    families={surnameFamilies}
                    value={lastName}
                    onValueChange={setLastName}
                    placeholder={t('Nazwisko rodowe')}
                  />
                </label>
              </div>
              <label className="unknown-surname-option">
                <input
                  type="checkbox"
                  checked={unknownSurname}
                  onChange={(event) => setUnknownSurname(event.target.checked)}
                />
                {t('Nieznane nazwisko')}
              </label>
              <label>
                {t('Imię wołane')}
                <input
                  value={familiarName}
                  maxLength={500}
                  onChange={(event) => setFamiliarName(event.target.value)}
                />
              </label>
              <details className="relation-details">
                <summary>{t('Daty i miejsca')}</summary>
                <div className="relation-name-fields">
                  {(
                    [
                      ['birth', t('Data urodzenia')],
                      ['death', t('Data śmierci')],
                      ['birthPlace', t('Miejsce urodzenia')],
                      ['residence', t('Miejsce zamieszkania')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={details[key]}
                        maxLength={
                          key === 'birth' || key === 'death' ? 500 : 1000
                        }
                        onChange={(event) =>
                          setDetails((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              <label>
                {t('Płeć (opcjonalnie)')}
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">{t('Nie podano')}</option>
                  <option value="Mężczyzna">{t('Mężczyzna')}</option>
                  <option value="Kobieta">{t('Kobieta')}</option>
                  <option value="Inna">{t('Inna')}</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              {t('Wybierz osobę')}
              <select
                value={existing}
                required
                onChange={(event) => setExisting(event.target.value)}
              >
                <option value="">{t('Wybierz z listy…')}</option>
                {people
                  .filter(
                    (relative) =>
                      relative.id !== person.id && !relative.isPlaceholder,
                  )
                  .map((relative) => (
                    <option key={relative.id} value={relative.id}>
                      {nameWithDate(relative)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {kind === 'sibling' &&
            (context.parents.length ? (
              <fieldset className="inferred-family">
                <legend>
                  <Users size={15} />
                  {t('Wspólni rodzice — uzupełniono z drzewa')}
                </legend>
                {[
                  ...new Set(context.parents.map((parent) => parent.source)),
                ].map((id) => {
                  const parent = people.find((person) => person.id === id)!;
                  return (
                    <label className="inferred-parent" key={id}>
                      <input
                        type="checkbox"
                        checked={parentIds.includes(id)}
                        onChange={(event) =>
                          setParentIds((current) =>
                            event.target.checked
                              ? [...current, id]
                              : current.filter((parent) => parent !== id),
                          )
                        }
                      />
                      <span>
                        {fullName(parent)}
                        {parent.isPlaceholder && (
                          <small>{t('Dane do uzupełnienia')}</small>
                        )}
                      </span>
                    </label>
                  );
                })}
                <p>
                  {context.parents.length > 1
                    ? t(
                        'Znani rodzice są wybrani domyślnie. Pozostaw jednego dla rodzeństwa przyrodniego.',
                      )
                    : t(
                        'Wybrano znanego rodzica. Nie dodajemy drugiego bez danych.',
                      )}
                </p>
              </fieldset>
            ) : (
              <div className="info-note">
                <Users size={20} />
                <div>
                  <strong>{t('Rodzice jeszcze nieznani')}</strong>
                  <p>
                    {t(
                      'Utworzymy „Nieznany ojciec” i „Nieznana matka” oraz połączymy obie osoby jako ich dzieci. Dane rodziców możesz później uzupełnić w ich profilach.',
                    )}
                  </p>
                </div>
              </div>
            ))}
          {kind === 'child' && (
            <label>
              {t('Drugi rodzic')}
              <select
                aria-label={t('Drugi rodzic')}
                value={coParentId}
                onChange={(event) => {
                  setCoParentId(event.target.value);
                  setError('');
                }}
              >
                {context.partners.length > 1 && (
                  <option value="__choose__" disabled>
                    {t('Wybierz drugiego rodzica…')}
                  </option>
                )}
                <option value="">
                  {t('Tylko ten rodzic — bez przypisanego drugiego rodzica')}
                </option>
                {people
                  .filter((relative) => relative.id !== person.id)
                  .map((relative) => (
                    <option value={relative.id} key={relative.id}>
                      {nameWithDate(relative)}
                      {context.partners.some(
                        (partner) => partner.id === relative.id,
                      )
                        ? t(' · partner')
                        : ''}
                    </option>
                  ))}
              </select>
              <small>
                {context.partners.length === 1
                  ? t('Wybrano znanego partnera. Możesz zmienić ten wybór.')
                  : t('Wskaż drugiego rodzica, jeśli jest znany.')}
              </small>
            </label>
          )}
          {kind === 'child' && (
            <div className="inferred-family" aria-live="polite">
              <strong>{t('Podgląd połączeń')}</strong>
              <ul>
                <li>
                  {nameWithDate(person)} → {childName || t('Dziecko')}
                </li>
                {secondParent && (
                  <li>
                    {nameWithDate(secondParent)} → {childName || t('Dziecko')}
                  </li>
                )}
                {coParentId === '__choose__' && (
                  <li>
                    {t(
                      'Wybierz drugiego rodzica, aby zobaczyć jego połączenie.',
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}
          {(kind === 'child' || kind === 'parent') && (
            <label>
              {t('Typ relacji')}
              <select
                value={adopted ? 'adoption' : 'parent'}
                onChange={(event) =>
                  setAdopted(event.target.value === 'adoption')
                }
              >
                <option value="parent">{t('Biologiczna')}</option>
                <option value="adoption">{t('Adopcyjna')}</option>
              </select>
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="info-note">
            <Info size={17} />
            {t(
              'Zmiany zapisują się w lokalnej bazie. Nie uzupełniamy nieznanych dat ani miejsc.',
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            disabled={busy}
            className="btn secondary"
            onClick={onClose}
          >
            {t('Anuluj')}
          </button>
          <button disabled={busy} className="btn primary" type="submit">
            <Plus size={16} />
            {t('Dodaj do rodziny')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
