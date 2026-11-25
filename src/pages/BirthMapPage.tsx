import { fullName, t, useLanguage } from '../i18n';
import { GitBranch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type {} from 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import {
  birthClusters,
  validLocation,
  type BirthCluster,
} from '../mocks/geography';

import type { Person } from '../types';
let heatReady: Promise<unknown> | undefined;
export function BirthMapPage({
  people,
  onPerson,
  onTree,
}: {
  people: Person[];
  onPerson: (person: Person) => void;
  onTree: (id: string) => void;
}) {
  const language = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [zoom, setZoom] = useState(2);
  const [selected, setSelected] = useState<string[] | null>(null);
  const peoplePanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (peoplePanel.current) peoplePanel.current.scrollTop = 0;
  }, [selected]);
  const [heat, setHeat] = useState(true);
  const [mapError, setMapError] = useState('');
  const [heatLoaded, setHeatLoaded] = useState(false);
  const located = useMemo(
    () => people.filter((p) => validLocation(p.birthLocation)),
    [people],
  );
  const clusters = useMemo(() => birthClusters(people, zoom), [people, zoom]);
  const selectedPeople = selected
    ? people.filter((p) => selected.includes(p.id))
    : [];
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 18,
    }).setView([20, 0], 2);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () =>
        setMapError(t('Nie udało się wczytać podkładu mapy.')),
      )
      .addTo(instance);
    instance.on('zoomend', () => setZoom(instance.getZoom()));
    Object.assign(window, { L });
    heatReady ||= import('leaflet.heat');
    let active = true;
    heatReady
      .then(() => {
        if (active) setHeatLoaded(true);
      })
      .catch(() => {
        if (active) setMapError(t('Nie udało się wczytać obszarów gęstości.'));
      });
    const resize = new ResizeObserver(() =>
      instance.invalidateSize({ pan: false }),
    );
    resize.observe(container.current);
    return () => {
      active = false;
      resize.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const zoomControl = L.control
      .zoom({
        zoomInTitle: t('Powiększ'),
        zoomOutTitle: t('Pomniejsz'),
      })
      .addTo(map.current);
    return () => {
      zoomControl.remove();
    };
  }, [language]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const layer = L.layerGroup().addTo(instance);
    if (heat && heatLoaded && clusters.length)
      L.heatLayer(
        clusters.map((c) => [c.lat, c.lon, c.people.length]),
        {
          radius: 42,
          blur: 28,
          maxZoom: 0,
          max: Math.max(4, ...clusters.map((c) => c.people.length)),
          minOpacity: 0.2,
          gradient: {
            0.15: '#7eb7c4',
            0.4: '#eed479',
            0.65: '#e69a47',
            1: '#b94030',
          },
        },
      ).addTo(layer);
    for (const cluster of zoom > 2 ? clusters : []) {
      const count = cluster.people.length;
      const marker = L.marker([cluster.lat, cluster.lon], {
        icon: L.divIcon({
          className: 'birth-cluster',
          html: `<span>${count}</span>`,
          iconSize: [
            36 + Math.min(16, Math.log2(count) * 4),
            36 + Math.min(16, Math.log2(count) * 4),
          ],
        }),
      });
      const tooltip = document.createElement('span');
      tooltip.textContent =
        count === 1
          ? fullName(cluster.people[0])
          : t('{0} osób · kliknij, aby zobaczyć listę', count);
      marker
        .bindTooltip(tooltip)
        .on('click', () => setSelected(cluster.people.map((p) => p.id)))
        .addTo(layer);
      marker
        .getElement()
        ?.setAttribute('aria-label', t('Miejsce urodzenia: {0} osób', count));
    }
    return () => {
      instance.removeLayer(layer);
    };
  }, [clusters, heat, heatLoaded, zoom, language]);
  const fit = () => {
    if (!map.current) return;
    if (located.length)
      map.current.fitBounds(
        L.latLngBounds(
          located.map((p) => [p.birthLocation!.lat, p.birthLocation!.lon]),
        ),
        { padding: [50, 50], maxZoom: 10 },
      );
    else map.current.setView([20, 0], 2);
  };
  return (
    <section className="birth-map-page" aria-label={t('Mapa miejsc urodzenia')}>
      <div className="map-actions">
        <div>
          <strong>{t('Miejsca urodzenia')}</strong>
          <span>
            {t('Na mapie: {0} z {1} osób', located.length, people.length)}
          </span>
        </div>
        <div className="button-row">
          <label>
            <input
              type="checkbox"
              checked={heat}
              onChange={(e) => setHeat(e.target.checked)}
            />
            {t('Obszary gęstości')}
          </label>
          <button className="btn secondary" onClick={fit}>
            {t('Dopasuj miejsca')}
          </button>
          <button
            className="btn secondary"
            onClick={() => map.current?.setView([20, 0], 2)}
          >
            {t('Cały świat')}
          </button>
        </div>
      </div>
      <div className="map-workspace">
        <div
          className="map-surface"
          ref={container}
          aria-label={t('Interaktywna mapa świata')}
        />
        <aside
          className="map-people"
          ref={peoplePanel}
          aria-label={t('Osoby na mapie')}
          tabIndex={0}
        >
          <h3>
            {selected ? t('Osoby w wybranym obszarze') : t('Rodzinne miejsca')}
          </h3>
          {!selected && (
            <p>
              {t(
                'Kliknij liczbę na mapie. Przybliżenie rozdziela pobliskie miejsca.',
              )}
            </p>
          )}
          {selected && (
            <button className="btn text" onClick={() => setSelected(null)}>
              {t('Wyczyść wybór')}
            </button>
          )}
          {(selected ? selectedPeople : located).map((person) => (
            <div className="map-person" key={person.id}>
              <button onClick={() => onPerson(person)}>
                <strong>{fullName(person)}</strong>
                <span>
                  {person.birthPlace ||
                    person.birthLocation?.label ||
                    t('Współrzędne')}
                  {person.birth ? ` · ${person.birth}` : ''}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn map-show-person"
                aria-label={t('Pokaż na drzewie: {0}', fullName(person))}
                title={t('Pokaż na drzewie')}
                onClick={() => onTree(person.id)}
              >
                <GitBranch size={16} />
              </button>
            </div>
          ))}
          {!located.length && (
            <p>
              {t(
                'Jeszcze nie przypisano punktów. Otwórz profil i wybierz miejscowość albo podaj współrzędne.',
              )}
            </p>
          )}
          <details>
            <summary>
              {t('Bez lokalizacji na mapie (')}
              {people.length - located.length})
            </summary>
            {people
              .filter((p) => !validLocation(p.birthLocation))
              .map((person) => (
                <button
                  className="map-missing-person"
                  key={person.id}
                  onClick={() => onPerson(person)}
                >
                  {fullName(person)}
                  <small>
                    {person.birthPlace || t('Brak miejsca urodzenia')}{' '}
                    {t('— uzupełnij punkt')}
                  </small>
                </button>
              ))}
          </details>
        </aside>
      </div>
      {mapError && (
        <div className="map-footnote" role="status">
          {mapError}
        </div>
      )}
    </section>
  );
}
