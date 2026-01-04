'use client';

/**
 * Dashboard Layout for all authenticated pages
 * This layout is persistent across navigation, so sidebar and header stay visible
 */

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

