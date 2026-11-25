import { serverMessage, t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Download, Plus, FileText } from 'lucide-react';
import { Modal } from './ui';
import { request } from '../services/api';

export function NewTreeDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<boolean>;
}) {
  useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      title={t('Nowa rodzinna historia')}
      eyebrow={t('POSADŹ PIERWSZE KORZENIE')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        {t('Nadaj swojemu drzewu nazwę. Zapiszemy je na tym komputerze.')}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          if (!(await onCreate(name.trim(), description)))
            setError(
              t(
                'Nie udało się utworzyć drzewa. Sprawdź komunikat i spróbuj ponownie.',
              ),
            );
          setBusy(false);
        }}
      >
        <div className="form-stack">
          <label>
            {t('Nazwa drzewa')}
            <input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('np. Rodzina Wiśniewskich')}
            />
          </label>
          <label>
            {t('Krótki opis (opcjonalnie)')}
            <textarea
              rows={3}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
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
            {busy ? t('Tworzenie…') : t('Utwórz drzewo')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (id: string) => Promise<void>;
}) {
  useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    treeId: string;
    people: number;
    mediaCount: number;
    warning: string;
  } | null>(null);
  return (
    <Modal
      title={t('Przynieś swoją historię')}
      eyebrow={t('IMPORT GEDCOM / GEDZIP / ZIP')}
      onClose={() => {
        if (!busy) {
          if (result) void onDone(result.treeId);
          else onClose();
        }
      }}
    >
      {result ? (
        <div className="form-stack import-result">
          <h3>{t('Rodzina została zaimportowana')}</h3>
          <p>
            {t('Osoby: {0} · Pliki: {1}', result.people, result.mediaCount)}
          </p>
          {result.warning && (
            <p className="info-note" role="status">
              {serverMessage(result.warning)}
            </p>
          )}
          <button
            className="btn primary"
            onClick={() => void onDone(result.treeId)}
          >
            {t('Otwórz zaimportowane drzewo')}
          </button>
        </div>
      ) : (
        <>
          <div className="form-stack">
            <label>
              {t('Plik .ged (do 20 MB), .gdz / .gedzip / .zip (do 40 MB)')}
              <input
                type="file"
                accept=".ged,.gedcom,.gdz,.gedzip,.zip"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <p>
              {t(
                'Import tworzy osobny album. Plik GEDCOM musi mieć kodowanie UTF-8. Obsługuje GEDCOM 5.5.1 i 7 oraz pakiety ZIP/GEDZIP ze zdjęciami i dokumentami. Zwykły .ged nie zawiera plików. Źródła, cytowania i pozostałe nieobsługiwane pola zachowaj w oryginalnym pliku.',
              )}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button disabled={busy} className="btn secondary" onClick={onClose}>
              {t('Anuluj')}
            </button>
            <button
              className="btn primary"
              disabled={busy || !file}
              onClick={async () => {
                if (!file || busy) return;
                setBusy(true);
                setError('');
                try {
                  const data = new FormData();
                  data.append('file', file);
                  const imported = await request<{
                    treeId: string;
                    people: number;
                    mediaCount: number;
                    warning: string;
                  }>('/api/import', { method: 'POST', body: data });
                  setResult(imported);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : t('Nie udało się odczytać pliku.'),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t('Importowanie…') : t('Importuj do nowego albumu')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
export function ExportDialog({
  onClose,
  count,
  treeId,
}: {
  onClose: () => void;
  count: number;
  treeId: string;
}) {
  useLanguage();
  const [format, setFormat] = useState('gdz');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={t('Zabierz historię ze sobą')}
      eyebrow={t('EKSPORT DANYCH I MEDIÓW')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        {t('Eksport osób: {0}. Obejmuje relacje i notatki.', count)}
      </p>
      <div className="export-options">
        {[
          [
            'ged551',
            'GEDCOM 5.5.1',
            '.ged · dla starszych aplikacji genealogicznych',
          ],
          [
            'zip551',
            t('GEDCOM 5.5.1 z plikami'),
            '.zip · rozpakuj i importuj gedcom.ged w wybranym programie',
          ],
          ['ged', 'GEDCOM 7', '.ged · dane i odwołania do mediów'],
          ['gdz', 'GEDZIP', '.gdz · dane, portrety, zdjęcia i dokumenty'],
        ].map(([value, title, description]) => (
          <label key={value} className={format === value ? 'selected' : ''}>
            <input
              type="radio"
              name="format"
              checked={format === value}
              onChange={() => setFormat(value)}
            />
            <FileText size={25} />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="info-note">
        {t(
          'Wybierz GEDZIP lub ZIP z GEDCOM 5.5.1, aby przenieść także pliki. Obsługa GEDCOM 7 i mediów zależy od aplikacji docelowej. Pełną kopię SQLite i plików pobierzesz z menu bazy danych.',
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <button className="btn secondary" disabled={busy} onClick={onClose}>
          {t('Zamknij')}
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const response = await fetch(
                `/api/trees/${encodeURIComponent(treeId)}/export?format=${format}`,
              );
              if (!response.ok)
                throw new Error(t('Nie udało się wygenerować eksportu.'));
              const url = URL.createObjectURL(await response.blob());
              const link = document.createElement('a');
              link.href = url;
              link.download = `rodzinny-album.${format === 'ged551' ? 'ged' : format === 'zip551' ? 'zip' : format}`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : t('Błąd eksportu.'),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} />
          {busy ? t('Przygotowywanie…') : t('Pobierz eksport')}
        </button>
      </div>
    </Modal>
  );
}
