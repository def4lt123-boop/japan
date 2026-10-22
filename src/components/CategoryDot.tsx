'use client';

import React from 'react';
import { categoryMeta } from '../lib/categories';
import { cx } from './ui';

/**
 * Symbol + Farbe einer Kategorie als Puffer – damit in langen Listen jede Kategorie
 * auf einen Blick zu erkennen ist (dasselbe Paar wie auf der Karte und in der Legende).
 */
export function CategoryDot({
  category,
  size = 20,
  className,
  title,
}: {
  category?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const meta = categoryMeta(category);
  return (
    <span
      aria-hidden
      title={title ?? `${meta.icon} ${meta.label}`}
      className={cx('inline-flex shrink-0 select-none items-center justify-center rounded-full leading-none', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6), background: `${meta.color}2e`, boxShadow: `inset 0 0 0 1px ${meta.color}70` }}
    >
      {meta.icon}
    </span>
  );
}
