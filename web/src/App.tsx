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
import ProtectedRoute from './components/ProtectedRoute';

import Feeds from './pages/Feeds';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route path="/files" element={<div className="p-8 text-gray-500">Files placeholder</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
