import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { AppShell } from '@/src/components/AppShell';
import { CommandPalette } from '@/src/components/CommandPalette';
import { SnippetsProvider } from '@/src/features/snippets/context';
import { EmbedSandboxPage } from '@/src/pages/EmbedSandboxPage';
import { EmbedWidgetPage } from '@/src/pages/EmbedWidgetPage';
import { LoginPage } from '@/src/pages/LoginPage';
import { NewSnippetPage } from '@/src/pages/NewSnippetPage';
import { RawFilePage } from '@/src/pages/RawFilePage';
import { SnippetDetailPage } from '@/src/pages/SnippetDetailPage';
import { WorkspaceHomePage } from '@/src/pages/WorkspaceHomePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SnippetsProvider>
        <BrowserRouter>
          <CommandPalette />
          <Routes>
            {/* Standalone focused routes without the workspace rail */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/embed/:snippetId" element={<EmbedWidgetPage />} />
            <Route path="/raw/:snippetId" element={<RawFilePage />} />

            {/* Snipbase split-pane workspace routes */}
            <Route element={<ShellLayout />}>
              <Route path="/" element={<WorkspaceHomePage />} />
              <Route path="/snippets" element={<WorkspaceHomePage />} />
              <Route path="/snippets/new" element={<NewSnippetPage />} />
              <Route path="/snippets/:snippetId" element={<SnippetDetailPage />} />
              <Route
                path="/snippets/:snippetId/edit"
                element={<SnippetDetailPage initialView="edit" />}
              />
              <Route path="/sandbox" element={<EmbedSandboxPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SnippetsProvider>
    </QueryClientProvider>
  );
}
