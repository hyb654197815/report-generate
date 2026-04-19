import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { AiSettingsPage } from './pages/AiSettingsPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { DesignerPage } from './pages/DesignerPage';
import { GeneratePage } from './pages/GeneratePage';
import { NewTemplatePage } from './pages/NewTemplatePage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { WordEditPage } from './pages/WordEditPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<TemplatesPage />} />
                <Route path="/components" element={<ComponentsPage />} />
                <Route path="/settings/ai" element={<AiSettingsPage />} />
                <Route path="/templates/new" element={<NewTemplatePage />} />
                <Route path="/templates/:id" element={<TemplateDetailPage />} />
                <Route path="/templates/:id/word" element={<WordEditPage />} />
                <Route path="/templates/:id/design" element={<DesignerPage />} />
                <Route path="/templates/:id/generate" element={<GeneratePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
