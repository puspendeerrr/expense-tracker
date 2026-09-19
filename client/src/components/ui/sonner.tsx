import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts.
 *
 * Positioned bottom-centre on phones and bottom-right on larger screens. Top-right put
 * them straight over the page toolbar, where they covered the very controls someone had
 * just used. The bottom offset clears the mobile tab bar and the home indicator.
 */
export const Toaster: React.FC<ToasterProps> = ({ ...props }) => {
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
      className="toaster group"
      richColors
      closeButton
      position={isMobile ? 'bottom-center' : 'bottom-right'}
      offset={isMobile ? 'calc(4.75rem + env(safe-area-inset-bottom))' : '1.5rem'}
      // Below the dialog layer (z-50): a toast must never cover a modal's actions.
      // While a dialog is open the modal is the focus, so this is the right priority.
      style={{ zIndex: 40 }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl font-sans text-sm',
          description: 'group-[.toast]:text-slate-500 text-xs font-normal',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-white text-xs font-semibold rounded-lg',
          cancelButton:
            'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-600 text-xs font-semibold rounded-lg',
          error:
            'group-[.toaster]:!bg-rose-50 group-[.toaster]:!text-rose-950 group-[.toaster]:!border-rose-200',
          success:
            'group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-950 group-[.toaster]:!border-emerald-200',
          info:
            'group-[.toaster]:!bg-sky-50 group-[.toaster]:!text-sky-950 group-[.toaster]:!border-sky-200',
          warning:
            'group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-950 group-[.toaster]:!border-amber-200',
        },
      }}
      {...props}
    />
  );
};

