import React from 'react';
import { Dashboard } from './Dashboard';

/**
 * Analytics & Power BI View
 * Unified with the central Dashboard control tower.
 */
export const Analytics: React.FC = () => {
  return <Dashboard defaultTab="analytics" />;
};

export default Analytics;
