import { useSelector } from 'react-redux';
import { cn } from '../../lib/utils';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { RootState } from '../../store';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <Sidebar />
      <main
        className={cn(
          "transition-all duration-300 pt-4 px-4 pb-8",
          sidebarOpen ? "md:ml-64" : ""
        )}
      >
        {children}
      </main>
    </div>
  );
}
