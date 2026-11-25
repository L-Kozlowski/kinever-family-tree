import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { Expand, Shrink } from 'lucide-react';

export function CanvasFullscreen() {
  useLanguage();
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => {
      const expanded = document.fullscreenElement === document.documentElement;
      setActive(expanded);
      if (!document.fullscreenElement)
        document.documentElement.classList.remove('tree-fullscreen');
    };
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      if (document.documentElement.classList.contains('tree-fullscreen')) {
        document.documentElement.classList.remove('tree-fullscreen');
        if (document.fullscreenElement)
          void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);
  const toggle = async () => {
    setError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        document.documentElement.classList.add('tree-fullscreen');
      }
    } catch {
      setError(t('Nie można włączyć pełnego ekranu w tej przeglądarce.'));
    }
  };
  return (
    <div className="canvas-fullscreen">
      <button
        className="icon-btn"
        onClick={() => void toggle()}
        aria-pressed={active}
        aria-label={
          active
            ? t('Wyjdź z pełnego ekranu')
            : t('Otwórz drzewo na pełnym ekranie')
        }
        title={
          active ? t('Wyjdź z pełnego ekranu (Esc)') : t('Pełny ekran drzewa')
        }
      >
        {active ? <Shrink size={18} /> : <Expand size={18} />}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
