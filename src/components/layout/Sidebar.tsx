import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Sparkles, Plus, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { openAddHoldingModal } from '../../features/ui/uiSlice';
import type { RootState } from '../../store';

interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/#dashboard' },
  { icon: Briefcase, label: 'Holdings', to: '/#holdings' },
  { icon: Sparkles, label: 'AI Insights', to: '/#insights' },
  { icon: BookOpen, label: 'Journal', to: '/journal' },
];

export function Sidebar() {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen);

  return (
    <aside
      className={cn(
        "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 border-r border-gray-200 bg-white transition-transform duration-300 md:translate-x-0 dark:border-gray-700 dark:bg-gray-900",
        !sidebarOpen && "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full p-4">
        <Button className="mb-6 gap-2" onClick={() => dispatch(openAddHoldingModal())}>
          <Plus className="h-4 w-4" />
          Add Holding
        </Button>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Data from Yahoo Finance
          </p>
        </div>
      </div>
    </aside>
  );
}
