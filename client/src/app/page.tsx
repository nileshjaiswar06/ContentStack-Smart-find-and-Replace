'use client';

import React from 'react';
import { ContentstackApp } from '@/components/ContentstackApp';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function SmartFindReplaceApp() {
  return (
    <ErrorBoundary>
      <ContentstackApp />
    </ErrorBoundary>
  );
}