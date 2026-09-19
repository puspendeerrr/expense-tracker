import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';

/**
 * Light / dark / system switcher.
 *
 * Three options rather than a two-state toggle, because "system" is a real preference
 * and not the same as whichever colour it happens to resolve to right now: someone who
 * picks it expects the app to keep following their OS afterwards.
 *
 * The trigger shows the *resolved* icon -- a sun while light, a moon while dark -- so it
 * reflects what you are looking at, while the accessible name carries the preference
 * itself, which the icon alone cannot distinguish for "system".
 */

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11 shrink-0', className)}
          aria-label={`Theme: ${preference}. Change theme`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setPreference(option.value)}
            className={cn(preference === option.value && 'font-semibold text-primary')}
          >
            <option.icon className="mr-2 h-4 w-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
