import { useEffect } from 'react';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/Home';
import { NotFoundPage } from './pages/NotFound';
import { ReportEditorPage } from './pages/ReportEditor';
import { cleanUpLegacyData } from './services/store';

/** مفتاح مختلف لكل تقرير حتى يبدأ النموذج من الصفر */
function ReportEditorRoute() {
  const { id } = useParams();
  const location = useLocation();
  return <ReportEditorPage key={id ?? location.key} reportId={id} />;
}

export default function App() {
  useEffect(() => cleanUpLegacyData(), []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="reports/new" element={<ReportEditorRoute />} />
        <Route path="reports/:id" element={<ReportEditorRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
