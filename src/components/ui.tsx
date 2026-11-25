import { t, useLanguage } from '../i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, Leaf } from 'lucide-react';
import brandSymbol from '../../assets/branding/logo.png';
import brandLogo from '../../assets/branding/logo_with_name.png';

export function Brand() {
  return (
    <picture>
      <source media="(max-width: 850px)" srcSet={brandSymbol} />
      <img className="brand" src={brandLogo} alt="" />
    </picture>
  );
}
export function Botanical({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`botanical ${className}`}
      viewBox="0 0 260 280"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M39 276Q158 172 182 10M90 222Q117 140 77 83M128 170Q197 139 235 65M157 111Q119 79 116 29"
        stroke="currentColor"
        strokeWidth="2"
      />
      {[
        [173, 38, -30],
        [156, 78, -40],
        [135, 119, -35],
        [111, 164, -45],
        [82, 206, -40],
        [185, 119, 35],
        [210, 88, 35],
        [90, 125, -55],
        [76, 93, -45],
        [132, 67, -45],
        [117, 36, -30],
      ].map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="12"
          ry="27"
          transform={`rotate(${r} ${x} ${y})`}
          fill="currentColor"
          opacity={i % 2 ? '.45' : '.7'}
        />
      ))}
    </svg>
  );
}
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  className = '',
  headerActions,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  headerActions?: ReactNode;
}) {
  useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement as HTMLElement;
    dialog.showModal();
    return () => {
      dialog.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="modal-head-actions">
          {headerActions}
          <button
            className="icon-btn"
            aria-label={t('Zamknij okno')}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
      </div>
      {children}
    </dialog>
  );
}
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Leaf size={35} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
