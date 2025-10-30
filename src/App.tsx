import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Registry } from './pages/Registry';
import { Gazettes } from './pages/Gazettes';
import { Notices } from './pages/Notices';
import { Settings } from './pages/Settings';
import { ReviewQueue } from './pages/ReviewQueue';
import { Monitor } from './pages/Monitor';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="registry" element={<Registry />} />
            <Route path="gazettes" element={<Gazettes />} />
            <Route path="notices" element={<Notices />} />
            <Route path="monitor" element={<Monitor />} />
            <Route path="settings" element={<Settings />} />
            <Route path="review" element={<ReviewQueue />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
