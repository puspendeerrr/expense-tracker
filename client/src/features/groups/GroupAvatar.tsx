import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/names';

/**
 * A group's picture, or its initials when it has none.
 *
 * One component so a group looks the same in the sidebar, the switcher and the group
 * list. It falls back to initials not only when there is no URL but also when the image
 * fails to load: a Cloudinary asset can be deleted out from under us, and a broken-image
 * icon in a navigation list is worse than the initials it replaced.
 */
export const GroupAvatar: React.FC<{
  name: string;
  url?: string | null;
  className?: string;
}> = ({ name, url, className }) => {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-[11px] font-bold text-primary',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};
