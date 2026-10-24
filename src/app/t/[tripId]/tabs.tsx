'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '../../../components/ui';

export interface Tab {
  href: string;
  label: string;
  /** das eine Wort auf der unteren Leiste, wenn für den vollen Namen kein Platz ist */
  short?: string;
  icon: string;
}

export function TabLink({ tab, tripId }: { tab: Tab; tripId: string }) {
  const pathname = usePathname() ?? '';
  const href = `/t/${tripId}${tab.href}`;
  const active = tab.href === '' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={cx('tab', active && 'tab-active')}>
      <span aria-hidden>
        {tab.icon}
      </span>
      <span className="tab-label-short">{tab.short ?? tab.label}</span>
      <span className="tab-label-full">{tab.label}</span>
    </Link>
  );
}
