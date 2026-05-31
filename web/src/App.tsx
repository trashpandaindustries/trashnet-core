/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          {/* Placeholders for future phases */}
          <Route path="/notes" element={<div className="p-8 text-gray-500">Notes placeholder</div>} />
          <Route path="/bookmarks" element={<div className="p-8 text-gray-500">Bookmarks placeholder</div>} />
          <Route path="/kanban" element={<div className="p-8 text-gray-500">Kanban placeholder</div>} />
          <Route path="/feeds" element={<div className="p-8 text-gray-500">Feeds placeholder</div>} />
          <Route path="/files" element={<div className="p-8 text-gray-500">Files placeholder</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
