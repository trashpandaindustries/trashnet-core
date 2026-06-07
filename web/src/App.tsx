/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Notes from './pages/Notes';
import Bookmarks from './pages/Bookmarks';
import Kanban from './pages/Kanban';
import WebSearch from './pages/WebSearch';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './components/ThemeProvider';

import Feeds from './pages/Feeds';
import Files from './pages/Files';
import Preferences from './pages/Preferences';
import Admin from './pages/Admin';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/notes" element={<Notes />} />
              {/* Placeholders for future phases */}
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/feeds" element={<Feeds />} />
              <Route path="/files" element={<Files />} />
              <Route path="/search" element={<WebSearch />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
