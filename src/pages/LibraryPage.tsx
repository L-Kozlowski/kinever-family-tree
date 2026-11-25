import { t, useLanguage } from '../i18n';
import {
  ArrowRight,
  Plus,
  Upload,
  GitBranch,
  Users,
  Clock,
  Leaf,
} from 'lucide-react';
import type { FamilyTree } from '../types';
import { Botanical, EmptyState } from '../components/ui';
import { Portrait } from '../components/Portrait';

export function LibraryPage({
  trees,
  onOpen,
  onNew,
  onImport,
}: {
  trees: FamilyTree[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
}) {
  useLanguage();
  return (
    <div className="library">
      <header className="page-top">
        <span>{t('Twój rodzinny album')}</span>
        <span className="local-label">
          <span />
          {t('LOKALNY ALBUM')}
        </span>
      </header>
      <section className="library-hero">
        <div>
          <div className="eyebrow">
            <span className="short-line" />
            {t('BLISKOŚĆ ZACZYNA SIĘ OD PAMIĘCI')}
          </div>
          <h1>
            {t('Wszystko zaczyna się')}
            <br />
            {t('od')} <em>{t('naszych korzeni.')}</em>
          </h1>
          <p>
            {t('Zachowaj twarze, połącz pokolenia i odkryj historie,')}
            <br className="desktop-break" />
            {t('które tworzą Twoją rodzinę.')}
          </p>
          <button className="btn primary" onClick={onNew}>
            <Plus size={18} />
            {t('Stwórz nowe drzewo')}
          </button>
        </div>
        <div className="hero-art">
          <Botanical />
          <div className="album-photo one">
            <Portrait variant={0} name={t('Przykładowy przodek')} />
            <span>{t('Nasze wspomnienia')}</span>
          </div>
          <div className="album-photo two">
            <Portrait variant={1} name={t('Przykładowa przodkini')} />
            <span>{t('Na zawsze blisko')}</span>
          </div>
          <span className="art-caption">
            {t('małe historie. wielkie więzi.')}
          </span>
        </div>
      </section>
      <section className="tree-library">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('TWOJE RODZINNE OPOWIEŚCI')}</span>
            <h2>
              {t('Moje drzewa')}
              <span className="count">{trees.length}</span>
            </h2>
          </div>
          <button className="btn text" onClick={onImport}>
            <Upload size={17} />
            {t('Importuj rodzinę')}
          </button>
        </div>
        {trees.length === 0 ? (
          <EmptyState
            title={t('Tu zacznie się Twoja historia')}
            text={t('Dodaj pierwsze drzewo i poznaj swój rodzinny album.')}
            action={
              <button className="btn primary" onClick={onNew}>
                {t('Utwórz drzewo')}
              </button>
            }
          />
        ) : (
          <div className="tree-grid">
            {trees.map((tree, i) => (
              <button
                className="tree-tile"
                key={tree.id}
                onClick={() => onOpen(tree.id)}
              >
                <div className={`tree-cover cover-${i % 2}`}>
                  <span className="cover-label">
                    <GitBranch size={14} />
                    {t('ALBUM RODZINNY')}
                  </span>
                  <div className="mini-family">
                    <div className="mini-portrait">
                      <Portrait
                        variant={i % 2}
                        name={t('Przykładowy portret')}
                      />
                    </div>
                    <span className="mini-branch" />
                    <div className="mini-row">
                      <div className="mini-portrait">
                        <Portrait variant={2} name={t('Przykładowy portret')} />
                      </div>
                      <div className="mini-portrait">
                        <Portrait variant={3} name={t('Przykładowy portret')} />
                      </div>
                    </div>
                  </div>
                  <Botanical />
                </div>
                <div className="tile-body">
                  <h3>
                    {tree.name}
                    <ArrowRight size={19} />
                  </h3>
                  <p>{tree.description}</p>
                  <div className="tile-meta">
                    <span>
                      <Users size={14} />
                      {t('Liczba osób: {0}', tree.people.length)}
                    </span>
                    <span>
                      <Clock size={13} />
                      {tree.updated}
                    </span>
                  </div>
                </div>
              </button>
            ))}
            <button className="new-tree-tile" onClick={onNew}>
              <span className="new-plus">
                <Plus size={25} />
              </span>
              <h3>{t('Kolejna rodzinna historia')}</h3>
              <p>
                {t('Każda gałąź zasługuje')}
                <br />
                {t('na swoje miejsce.')}
              </p>
              <span>
                {t('Dodaj nowe drzewo')}
                <ArrowRight size={16} />
              </span>
            </button>
          </div>
        )}
      </section>
      <footer className="library-footer">
        <Leaf size={16} />
        <span>
          {t('Przeszłość, którą pielęgnujemy. Bliskość, która zostaje.')}
        </span>
        <small>{t('Dane są zapisywane na tym komputerze.')}</small>
      </footer>
    </div>
  );
}
