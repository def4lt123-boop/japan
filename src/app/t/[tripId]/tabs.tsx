'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '../../../components/ui';

export function TabLink({ tab, tripId }: { tab: { href: string; label: string; icon: string }; tripId: string }) {
  const pathname = usePathname() ?? '';
  const href = `/t/${tripId}${tab.href}`;
  const active = tab.href === '' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={cx('tab', active && 'tab-active')}>
      <span aria-hidden className="mr-1">
        {tab.icon}
      </span>
      {tab.label}
    </Link>
  );
}
