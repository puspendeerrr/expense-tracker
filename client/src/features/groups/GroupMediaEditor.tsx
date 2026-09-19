import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, ImageOff, Loader2, Trash2, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { initialsOf } from '@/lib/names';
import { UploadError, uploadImage } from '@/lib/upload';
import { ApiClientError } from '@/lib/api';
import { setGroupMedia } from '@/lib/domainApi';

/**
 * Group avatar and cover.
 *
 * Shown as the banner it will become rather than as two file inputs, so the person
 * choosing an image can see the crop they are actually getting -- a wide cover with the
 * avatar overlapping its lower edge, which is how the group then appears everywhere
 * else.
 *
 * The browser uploads to Cloudinary directly and sends only the resulting URL and
 * public id to our API, so no image transits our server and no API secret reaches the
 * client. Upload and save are separate failures and are reported separately: an image
 * that reached Cloudinary but not our database is a different problem from one that
 * never uploaded, and telling someone "upload failed" when it did not is how people end
 * up with duplicate assets.
 */

type Slot = 'avatar' | 'cover';

interface GroupMediaEditorProps {
  groupId: string;
  groupName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  /** Creator-only; the server enforces the same rule. */
  canEdit: boolean;
  onChanged: () => void;
}

export const GroupMediaEditor: React.FC<GroupMediaEditorProps> = ({
  groupId,
  groupName,
  avatarUrl,
  coverUrl,
  canEdit,
  onChanged,
}) => {
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!env.cloudinary.isConfigured) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <ImageOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-muted-foreground">
          Image uploads are not configured on this deployment, so group pictures cannot be
          changed here.
        </p>
      </div>
    );
  }

  const save = async (slot: Slot, value: { url: string; publicId: string } | null) => {
    await setGroupMedia(groupId, { [slot]: value ?? { url: null, publicId: null } });
    onChanged();
  };

  const upload = async (slot: Slot, file: File) => {
    if (busySlot) return;
    setError(null);
    setBusySlot(slot);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const uploaded = await uploadImage(file, {
        folder: `${env.cloudinary.folder}/groups`,
        signal: controller.signal,
        onProgress: setProgress,
      });

      await save(slot, uploaded);
      toast.success(slot === 'avatar' ? 'Group picture updated' : 'Cover updated');
    } catch (err: unknown) {
      if (err instanceof UploadError) {
        setError(err.message);
      } else if (err instanceof ApiClientError) {
        // The image is on Cloudinary but the group was not updated. Say so, rather
        // than implying the upload itself failed.
        setError(`Uploaded, but could not be saved: ${err.message}`);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusySlot(null);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const remove = async (slot: Slot) => {
    if (busySlot) return;
    setError(null);
    setBusySlot(slot);
    try {
      await save(slot, null);
      toast.success(slot === 'avatar' ? 'Group picture removed' : 'Cover removed');
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not remove that image.',
      );
    } finally {
      setBusySlot(null);
    }
  };

  const pick = (slot: Slot) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first so choosing the same file twice still fires a change event.
    event.target.value = '';
    if (file) void upload(slot, file);
  };

  const isBusy = busySlot !== null;

  return (
    <div className="space-y-3">
      {/* ---- Preview ---- */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div
          className={cn(
            'relative h-28 bg-muted sm:h-36',
            coverUrl ? '' : 'bg-gradient-to-br from-primary/15 to-primary/5',
          )}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}

          {canEdit && (
            <div className="absolute right-2 top-2 flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-card/90 backdrop-blur"
                disabled={isBusy}
                onClick={() => coverInput.current?.click()}
              >
                {busySlot === 'cover' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5 sm:mr-1.5" />
                )}
                <span className="hidden sm:inline">{coverUrl ? 'Change' : 'Add cover'}</span>
              </Button>

              {coverUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-11 bg-card/90 px-0 backdrop-blur"
                  disabled={isBusy}
                  onClick={() => void remove('cover')}
                  aria-label="Remove cover image"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3 px-3 pb-3">
          <div className="-mt-7 shrink-0">
            {React.createElement(
              canEdit ? 'button' : 'div',
              {
                ...(canEdit
                  ? {
                      type: 'button' as const,
                      disabled: isBusy,
                      onClick: () => avatarInput.current?.click(),
                      'aria-label': avatarUrl
                        ? 'Change group picture'
                        : 'Add a group picture',
                    }
                  : {}),
                className: cn(
                  'relative block rounded-2xl',
                  canEdit &&
                    'press disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ),
              },
              <>
                <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-primary/10">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {initialsOf(groupName)}
                    </span>
                  )}
                </span>

                {canEdit && (
                  <span
                    aria-hidden
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
                  >
                    {busySlot === 'avatar' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </>,
            )}
          </div>

          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate text-sm font-bold">{groupName}</p>
            <p className="flex items-center gap-1 t-meta">
              <Users2 className="h-3 w-3" />
              How this group appears across SplitWise
            </p>
          </div>

          {canEdit && avatarUrl && (
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              disabled={isBusy}
              onClick={() => void remove('avatar')}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive sm:mr-1.5" />
              <span className="hidden sm:inline">Remove</span>
            </Button>
          )}
        </div>
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="t-meta">Uploading… {progress}%</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {!canEdit && (
        <p className="t-meta">Only the group creator can change these images.</p>
      )}

      <input
        ref={avatarInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pick('avatar')}
        tabIndex={-1}
      />
      <input
        ref={coverInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pick('cover')}
        tabIndex={-1}
      />
    </div>
  );
};
