/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LoopframeProvider, useLoopframe } from './context/LoopframeContext';
import { AppShell } from './components/AppShell';
import { WelcomePage } from './pages/WelcomePage';
import { ProjectsHomePage } from './pages/ProjectsHomePage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectStudioPage } from './pages/ProjectStudioPage';
import { MemoryPage } from './pages/MemoryPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';

const RouterView: React.FC = () => {
  const { currentPath } = useLoopframe();

  if (currentPath.startsWith('/welcome')) {
    return <WelcomePage />;
  }

  if (currentPath === '/projects/new') {
    return <NewProjectPage />;
  }

  if (currentPath.startsWith('/projects/')) {
    const projectId =
      currentPath.replace('/projects/', '').split('/')[0] || 'proj-sample-01';
    return <ProjectStudioPage projectId={projectId} />;
  }

  if (currentPath.startsWith('/memory')) {
    return <MemoryPage />;
  }

  if (currentPath.startsWith('/library')) {
    return <LibraryPage />;
  }

  if (currentPath.startsWith('/settings')) {
    return <SettingsPage />;
  }

  return <ProjectsHomePage />;
};

export default function App() {
  return (
    <LoopframeProvider>
      <AppShell>
        <RouterView />
      </AppShell>
    </LoopframeProvider>
  );
}
