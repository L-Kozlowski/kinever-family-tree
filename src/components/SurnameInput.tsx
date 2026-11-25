import { t, useLanguage } from '../i18n';
import { useId, useMemo, useState, type InputHTMLAttributes } from 'react';
import { surnameSuggestions } from '../mocks/surnameFamilies';
import type { Person, SurnameFamily } from '../types';
const normalize = (name: string) =>
  name
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  value: string;
  onValueChange: (value: string) => void;
  people: Person[];
  families?: SurnameFamily[];
};
export function SurnameInput({
  value,
  onValueChange,
  people,
  families,
  ...props
}: Props) {
  useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useMemo(
    () =>
      surnameSuggestions(people, families)
        .filter(
          (name) =>
            normalize(name).startsWith(normalize(value.trim())) &&
            normalize(name) !== normalize(value.trim()),
        )
        .slice(0, 8),
    [people, families, value],
  );
  const visible = open && value.trim().length > 0 && options.length > 0;
  const choose = (name: string) => {
    onValueChange(name);
    setOpen(false);
    setActive(-1);
  };
  return (
    <span className="surname-field">
      <input
        {...props}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        aria-activedescendant={
          visible && active >= 0 ? `${id}-${active}` : undefined
        }
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(e.target.value.trim().length > 0);
          setActive(-1);
        }}
        onBlur={(e) => {
          setOpen(false);
          setActive(-1);
          props.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (visible && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setActive((index) =>
              index < 0
                ? e.key === 'ArrowDown'
                  ? 0
                  : options.length - 1
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) %
                  options.length,
            );
          } else if (visible && e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            choose(options[active]);
          } else if (visible && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setActive(-1);
          }
          props.onKeyDown?.(e);
        }}
      />
      {visible && (
        <ul
          className="surname-options"
          id={id}
          role="listbox"
          aria-label={t('Podpowiedzi nazwisk')}
        >
          {options.map((name, index) => (
            <li
              key={name}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(name)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
