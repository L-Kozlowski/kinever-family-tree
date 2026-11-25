import { t, useLanguage } from '../i18n';
type Props = {
  variant: number;
  name: string;
  photo?: string;
  className?: string;
  unknown?: boolean;
};

/** Original code-native album illustrations; no external assets or personal photos. */
export function Portrait({
  variant,
  name,
  photo,
  className = '',
  unknown = false,
}: Props) {
  useLanguage();
  if (photo)
    return (
      <img
        className={`portrait ${className}`}
        src={photo}
        alt={t('Portret: {0}', name)}
      />
    );
  if (unknown)
    return (
      <svg
        className={`portrait ${className}`}
        viewBox="0 0 120 140"
        role="img"
        aria-label={t('Nieznany rodzic: {0}', name)}
      >
        <path fill="#d8c8aa" d="M0 0h120v140H0z" />
        <circle cx="60" cy="49" r="23" fill="#a68f6d" />
        <path d="M18 140v-18a42 42 0 0 1 84 0v18" fill="#a68f6d" />
        <text
          x="60"
          y="122"
          textAnchor="middle"
          fill="#f9efdc"
          fontSize="42"
          fontFamily="Georgia"
        >
          ?
        </text>
      </svg>
    );
  const woman = variant % 2 === 1;
  const elderly = variant < 2;
  const blond = variant === 4 || variant === 5;
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 120 140"
      role="img"
      aria-label={t('Ilustrowany portret domyślny: {0}', name)}
    >
      <defs>
        <radialGradient id={`paper-${variant}`}>
          <stop stopColor="#e8d8b6" />
          <stop offset="1" stopColor="#bca27b" />
        </radialGradient>
      </defs>
      <path fill={`url(#paper-${variant})`} d="M0 0h120v140H0z" />
      <path
        d="M12 140Q10 98 44 97h32q34 1 34 43"
        fill={woman ? '#665846' : '#514a3f'}
      />
      <path d="m42 99 18 36 18-36-12-10H54z" fill="#ddcbb0" />
      {!woman && (
        <>
          <path
            d="m42 99 18 36-24-14 5-9-11-5zM78 99l-18 36 24-14-5-9 11-5z"
            fill="#81715b"
          />
          <path d="m57 108 6 0 4 22-7 6-7-6z" fill="#574034" />
        </>
      )}
      {woman && (
        <path
          d="M33 110q27 18 54 0M45 119q15 9 30 0"
          fill="none"
          stroke="#b9a17a"
          strokeWidth="2"
        />
      )}
      {woman && (
        <path
          d="M31 68q-11-44 26-45 39-5 37 45l-7 31-15-3H46l-15 4z"
          fill={elderly ? '#c0b39e' : blond ? '#d7ba75' : '#66503b'}
        />
      )}
      <ellipse cx="60" cy="66" rx="26" ry="33" fill="#cba57d" />
      <ellipse cx="34" cy="68" rx="4" ry="8" fill="#bd9974" />
      <ellipse cx="86" cy="68" rx="4" ry="8" fill="#bd9974" />
      <path
        d={
          woman
            ? 'M33 57Q28 22 61 23q32 0 29 36-17-6-28-23-8 18-29 21'
            : 'M34 54q-7-28 24-31 35-4 29 32l-10-16q-21 8-34 0z'
        }
        fill={elderly ? '#b9b0a0' : blond ? '#d7ba75' : '#604a36'}
      />
      <path
        d="M43 61q6-4 12-1M66 60q6-3 12 1"
        fill="none"
        stroke="#71573e"
        strokeWidth="2"
      />
      <path
        d="M45 66h7M68 66h7"
        stroke="#4d4032"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m60 67-3 12 6 1M51 86q9 5 18-1"
        fill="none"
        stroke="#936e50"
        strokeWidth="1.5"
      />
      {elderly && (
        <path
          d="m42 73 8 2m20 0 8-2M43 81l3 4m30-4-3 4"
          stroke="#a27f5c"
          fill="none"
        />
      )}
      {elderly && !woman && (
        <path d="M47 83q13-11 26 0l-13-1z" fill="#b2a48b" />
      )}
      <path
        d="M6 6h108v128H6z"
        fill="none"
        stroke="#f5e6c8"
        strokeOpacity=".5"
      />
      <path
        d="M8 127q49-13 103 0"
        fill="none"
        stroke="#6d573d"
        strokeOpacity=".15"
      />
    </svg>
  );
}
