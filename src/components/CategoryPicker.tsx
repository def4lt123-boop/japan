'use client';

import React from 'react';
import { categoryOptions } from '../lib/categories';
import { Select, cx } from './ui';

/**
 * Kategorie als Dropdown: die festen Kategorien (mit Symbol) plus alles, was in
 * dieser Reise schon eingetragen ist – nichts geht verloren, nichts muss getippt werden.
 */
export function CategoryPicker({
  value,
  used = [],
  onChange,
  size = 'md',
  className,
  title,
}: {
  value?: string | null;
  /** Kategorien, die in der Reise schon vorkommen – bleiben wählbar */
  used?: (string | null)[];
  onChange: (category: string | null) => void;
  size?: 'md' | 'sm';
  className?: string;
  title?: string;
}) {
  const options = categoryOptions([...used, value ?? null]).map((o) => ({ value: o.value, label: `${o.icon}  ${o.label}` }));
  return (
    <Select
      className={cx(size === 'sm' ? '!w-[9.5rem] max-w-[42vw] !py-1 !text-[13px] truncate' : '', className)}
      allowEmpty
      emptyLabel="Kategorie wählen"
      options={options}
      value={value ?? ''}
      title={title ?? `Kategorie: ${value ?? 'noch keine'} – bestimmt Symbol, Farbe auf der Karte und die Gruppen`}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
