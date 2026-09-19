import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, Plus, QrCode, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useGroups } from '@/context/GroupContext';
import { InviteShare } from './InviteShare';
import { createGroup, joinGroup, previewInvite } from '@/lib/domainApi';

/** Shared page chrome: a narrow, centred column that works from 320px up. */
const PageShell: React.FC<{
  title: string;
  description?: string;
  onBack?: () => void;
  children: React.ReactNode;
}> = ({ title, description, onBack, children }) => (
  <div className="min-h-[100dvh] bg-slate-50">
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-3">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
      )}
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Create group                                                               */
/* -------------------------------------------------------------------------- */

export const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshGroups, setActiveGroupId } = useGroups();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (name.trim().length < 2) {
      setError('Group name must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const { group } = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await refreshGroups();
      setActiveGroupId(group.id);
      toast.success(`${group.name} created`);
      navigate('/app');
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create the group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Create a group"
      description="A group is where you and your flatmates or travel companions share expenses."
      onBack={() => navigate(-1)}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Apartment 402"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="group-description">Description (optional)</Label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Rent, groceries and bills for the flat"
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating group…' : 'Create group'}
        </Button>
      </form>
    </PageShell>
  );
};

/* -------------------------------------------------------------------------- */
/* Join group                                                                 */
/* -------------------------------------------------------------------------- */

export const JoinGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token?: string }>();
  const { refreshGroups, setActiveGroupId } = useGroups();

  const [invite, setInvite] = useState(token ?? '');
  const [preview, setPreview] = useState<{ groupName: string; memberCount: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(Boolean(token));

  // A shared /join/<token> link previews the group before asking anyone to commit.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void previewInvite(token)
      .then((data) => {
        if (!cancelled) setPreview({ groupName: data.groupName, memberCount: data.memberCount });
      })
      .catch(() => {
        if (!cancelled) setError('That invite is not valid or has been revoked.');
      })
      .finally(() => {
        if (!cancelled) setIsPreviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !invite.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await joinGroup(invite.trim());
      await refreshGroups();
      setActiveGroupId(result.group.id);
      toast.success(
        result.alreadyMember
          ? `You are already in ${result.group.name}`
          : `Joined ${result.group.name}`,
      );
      navigate('/app');
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not join that group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Join a group"
      description="Enter the 6-character code, or paste the invite link you were sent."
      onBack={() => navigate(-1)}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isPreviewing ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          preview && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <Users className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 font-semibold text-slate-900">{preview.groupName}</p>
              <p className="text-sm text-slate-500">
                {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          )
        )}

        <div className="space-y-1.5">
          <Label htmlFor="invite-code">Invite code or link</Label>
          <Input
            id="invite-code"
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-widest"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting || !invite.trim()}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Joining…' : 'Join group'}
        </Button>
      </form>
    </PageShell>
  );
};

/* -------------------------------------------------------------------------- */
/* Manage groups                                                              */
/* -------------------------------------------------------------------------- */

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { groups, activeGroupId, setActiveGroupId, isLoading, refreshGroups } = useGroups();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <PageShell title="Your groups" onBack={() => navigate('/app')}>
      <div className="space-y-5">
        <div className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  group.id === activeGroupId
                    ? 'border-primary ring-1 ring-primary/20'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{group.name}</p>
                  <p className="text-xs text-slate-500">
                    {group.memberCount ?? 0}{' '}
                    {(group.memberCount ?? 0) === 1 ? 'member' : 'members'}
                    {group.role === 'creator' && ' · you created it'}
                  </p>
                </div>
                {group.id === activeGroupId && (
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate('/app/groups/new')} className="flex-1">
            <Plus className="mr-1.5 h-4 w-4" />
            Create group
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/app/groups/join')}
            className="flex-1"
          >
            Join group
          </Button>
        </div>

        {/* ---- Invite sharing ---- */}
        {activeGroupId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setInviteOpen(true)}
          >
            <QrCode className="mr-2 h-4 w-4" />
            Show invite QR & code
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={() => void refreshGroups()} className="w-full">
          Refresh
        </Button>
      </div>

      {activeGroupId && (
        <InviteShare
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          groupId={activeGroupId}
          onRotated={() => void refreshGroups()}
        />
      )}
    </PageShell>
  );
};
