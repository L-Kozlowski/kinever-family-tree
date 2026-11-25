import { t, useLanguage } from '../i18n';
import { MapPinCheck, MapPinOff } from 'lucide-react';
import { useRef, useState } from 'react';
import type { GeoLocation } from '../types';
import { request } from '../services/api';
import { validLocation } from '../mocks/geography';

type PlaceResult = GeoLocation & { name: string };
export function LocationEditor({
  label,
  name,
  location,
  editing,
  onChange,
  compact = false,
}: {
  label: string;
  name: string;
  location?: GeoLocation;
  editing: boolean;
  compact?: boolean;
  onChange: (name: string, location?: GeoLocation) => void;
}) {
  useLanguage();
  const [mode, setMode] = useState<'name' | 'coordinates'>('name');
  const [lat, setLat] = useState(location ? String(location.lat) : '');
  const [lon, setLon] = useState(location ? String(location.lon) : '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const updateCoordinates = (latitude: string, longitude: string) => {
    setLat(latitude);
    setLon(longitude);
    generation.current++;
    setResults([]);
    const point = {
      lat: Number(latitude),
      lon: Number(longitude),
      label: name,
      source: 'manual' as const,
    };
    onChange(
      name,
      latitude.trim() && longitude.trim() && validLocation(point)
        ? point
        : undefined,
    );
  };
  if (!editing)
    return (
      <div className="location-readonly">
        <span>{label}</span>
        <span className="read-value location-value">
          {name || t('Nie podano')}
          <span
            className={
              validLocation(location)
                ? 'map-link-status linked'
                : 'map-link-status'
            }
            role="img"
            aria-label={
              validLocation(location)
                ? t('Przypisano do mapy')
                : t('Nie przypisano do mapy')
            }
            title={
              validLocation(location)
                ? t('Przypisano do mapy')
                : t('Nie przypisano do mapy')
            }
          >
            {validLocation(location) ? (
              <MapPinCheck size={16} />
            ) : (
              <MapPinOff size={16} />
            )}
          </span>
        </span>
      </div>
    );
  return (
    <section
      className="location-field"
      aria-label={label}
      onInvalidCapture={(e) => {
        const details = (e.target as HTMLElement).closest('details');
        if (details) details.open = true;
      }}
    >
      <label>
        {label}
        <input
          value={name}
          placeholder={t('np. Kraków, Polska')}
          onChange={(e) => {
            generation.current++;
            setResults([]);
            setError('');
            onChange(e.target.value, undefined);
          }}
        />
      </label>
      <details className="location-tools" open={compact ? undefined : true}>
        <summary>
          {validLocation(location) ? (
            <MapPinCheck size={14} />
          ) : (
            <MapPinOff size={14} />
          )}
          {validLocation(location)
            ? t('Punkt na mapie · zmień')
            : t('Przypisz do mapy')}
        </summary>
        <div className="location-tools-content">
          <div className="segmented small">
            <button
              type="button"
              aria-pressed={mode === 'name'}
              className={mode === 'name' ? 'active' : ''}
              onClick={() => setMode('name')}
            >
              {t('Miejscowość')}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'coordinates'}
              className={mode === 'coordinates' ? 'active' : ''}
              onClick={() => {
                setLat(location ? String(location.lat) : '');
                setLon(location ? String(location.lon) : '');
                setMode('coordinates');
              }}
            >
              {t('Współrzędne')}
            </button>
          </div>
          {mode === 'name' ? (
            <>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || name.trim().length < 2}
                onClick={async () => {
                  const token = ++generation.current;
                  setBusy(true);
                  setError('');
                  setResults([]);
                  try {
                    const found = await request<PlaceResult[]>(
                      '/api/places/search?q=' + encodeURIComponent(name.trim()),
                    );
                    if (token === generation.current) {
                      setResults(found);
                      if (!found.length)
                        setError(
                          t(
                            'Nie znaleziono miejscowości. Dodaj kraj lub wpisz współrzędne.',
                          ),
                        );
                    }
                  } catch (error) {
                    if (token === generation.current)
                      setError(
                        error instanceof Error
                          ? error.message
                          : t('Błąd wyszukiwania.'),
                      );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? t('Wyszukiwanie…') : t('Szukaj na mapie')}
              </button>
              <div className="place-results">
                {results.map((place, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => {
                      generation.current++;
                      const { name: placeName, ...point } = place;
                      onChange(placeName, point);
                      setLat(String(place.lat));
                      setLon(String(place.lon));
                      setResults([]);
                      setError('');
                    }}
                  >
                    <strong>{place.name}</strong>
                    <span>{place.label}</span>
                    <small>
                      {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="coordinate-inputs">
              <label>
                {t('Szerokość geograficzna')}
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required={!!lat || !!lon}
                  value={lat}
                  onChange={(e) => updateCoordinates(e.target.value, lon)}
                  placeholder={t('np. 52.2297')}
                />
              </label>
              <label>
                {t('Długość geograficzna')}
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required={!!lat || !!lon}
                  value={lon}
                  onChange={(e) => updateCoordinates(lat, e.target.value)}
                  placeholder={t('np. 21.0122')}
                />
              </label>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {validLocation(location) ? (
            <div className="linked-location">
              <strong>{t('Przypisano punkt')}</strong>
              <span>{location.label || name || t('Współrzędne ręczne')}</span>
              <small>
                {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
              </small>
              <button
                type="button"
                className="btn text"
                onClick={() => {
                  generation.current++;
                  onChange(name, undefined);
                  setLat('');
                  setLon('');
                }}
              >
                {t('Odłącz punkt')}
              </button>
            </div>
          ) : (
            <small>
              {t(
                'Nazwa bez wybranego wyniku lub poprawnych współrzędnych nie pojawi się na mapie.',
              )}
            </small>
          )}
          {mode === 'name' && (
            <small>
              {t(
                'Wyszukiwanie wysyła nazwę miejsca do OpenStreetMap/Nominatim. Dane osoby pozostają lokalnie.',
              )}
            </small>
          )}
        </div>
      </details>
    </section>
  );
}
