import * as React from 'react';
import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/context/ThemeContext';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts.
 *
 * Styled as the product's own surface rather than with a saturated status colour.
 * `richColors` washed the whole toast in a tint and then the overrides here fought it,
 * which is why they never looked like part of the app. Now every toast is the same
 * popover surface used by menus and dialogs, and the status is carried by a coloured
 * left edge and the icon -- enough to read at a glance, quiet enough to belong.
 *
 * Sonner keeps its own light/dark palette internally, so the resolved theme is handed
 * to it explicitly. Without that it assumes light and paints near-black text on a dark
 * surface.
 *
 * Bottom-centre on phones and bottom-right on larger screens: top-right put them over
 * the page toolbar, covering the controls someone had just used.
 */
export const Toaster: React.FC<ToasterProps> = ({ ...props }) => {
  const { resolved } = useTheme();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      closeButton
      position={isMobile ? 'bottom-center' : 'bottom-right'}
      // There is no mobile tab bar to clear any more, so this is just a comfortable
      // gutter plus the home indicator.
      offset={isMobile ? 'calc(1rem + env(safe-area-inset-bottom))' : '1.5rem'}
      // Below the dialog layer (z-50): a toast must never cover a modal's actions.
      style={
        {
          zIndex: 40,
          // Full width less a gutter on a phone; a fixed, readable column on desktop.
          '--width': isMobile ? 'calc(100vw - 2rem)' : '380px',
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: [
            'group toast font-sans text-sm',
            'group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground',
            'group-[.toaster]:border group-[.toaster]:border-border',
            'group-[.toaster]:rounded-xl group-[.toaster]:shadow-lg',
            // The status colour lives on the left edge.
            'group-[.toaster]:border-l-4',
          ].join(' '),
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground text-xs font-normal',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs font-semibold rounded-lg',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs font-semibold rounded-lg',
          closeButton:
            'group-[.toast]:bg-popover group-[.toast]:border-border group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground',

          // Only the edge and the icon change per status, so the text keeps the
          // popover's own foreground colour and stays readable in either theme.
          success:
            'group-[.toaster]:border-l-emerald-500 [&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400',
          error:
            'group-[.toaster]:border-l-destructive [&_[data-icon]]:text-destructive',
          warning:
            'group-[.toaster]:border-l-amber-500 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400',
          info: 'group-[.toaster]:border-l-sky-500 [&_[data-icon]]:text-sky-600 dark:[&_[data-icon]]:text-sky-400',
        },
      }}
      {...props}
    />
  );
};
