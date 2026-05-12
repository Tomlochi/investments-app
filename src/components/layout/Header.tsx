import { useDispatch, useSelector } from 'react-redux';
import { Moon, Sun, Menu, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { toggleTheme, toggleSidebar } from '../../features/ui/uiSlice';
import type { RootState } from '../../store';

export function Header() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-700 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => dispatch(toggleSidebar())}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-lg hidden sm:inline text-gray-900 dark:text-gray-100">Portfolio Manager</span>
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={() => dispatch(toggleTheme())}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  );
}
