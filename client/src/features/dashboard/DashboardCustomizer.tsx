import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  DashboardPreferences,
  WidgetDefinition,
  WidgetId,
} from './useDashboardPreferences';

/**
 * Dashboard layout editor.
 *
 * Reordering is offered two ways at once, and both are always present. Dragging is the
 * faster gesture with a mouse; the up/down buttons are the only way that works with a
 * keyboard, with a screen reader, or on a touch screen where a drag competes with the
 * page's own scrolling. Treating the buttons as the accessible fallback rather than a
 * second-class afterthought is why they are visible rather than hidden behind a mode.
 *
 * Changes apply immediately -- there is no Save. A layout editor with a commit step
 * makes people afraid to experiment, and every change here is trivially reversible.
 */

interface DashboardCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: DashboardPreferences;
  registry: WidgetDefinition[];
  onMove: (id: WidgetId, direction: -1 | 1) => void;
  onMoveTo: (id: WidgetId, index: number) => void;
  onToggle: (id: WidgetId) => void;
  onReset: () => Promise<void>;
}

export const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
  open,
  onOpenChange,
  preferences,
  registry,
  onMove,
  onMoveTo,
  onToggle,
  onReset,
}) => {
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const definitionFor = (id: WidgetId) => registry.find((widget) => widget.id === id);

  const resetAll = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customise your dashboard</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <p className="t-meta">
            Drag to reorder, or use the arrows. Hidden cards stay hidden in both summary
            and detailed mode.
          </p>

          <ul className="space-y-1.5">
            {preferences.widgets.map((widget, index) => {
              const definition = definitionFor(widget.id);
              if (!definition) return null;

              const isDragging = dragging === widget.id;
              const isTarget = dragOver === index && dragging !== widget.id;

              return (
                <li
                  key={widget.id}
                  draggable
                  onDragStart={() => setDragging(widget.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setDragOver(null);
                  }}
                  onDragOver={(event) => {
                    // Required, or the drop never fires.
                    event.preventDefault();
                    setDragOver(index);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging) onMoveTo(dragging, index);
                    setDragging(null);
                    setDragOver(null);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors',
                    isDragging && 'opacity-50',
                    isTarget ? 'border-primary' : 'border-border',
                    !widget.visible && 'opacity-60',
                  )}
                >
                  <GripVertical
                    className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{definition.label}</p>
                    <p className="truncate t-meta">
                      {definition.description}
                      {definition.inSummary ? '' : ' · detailed mode only'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-9"
                      disabled={index === 0}
                      onClick={() => onMove(widget.id, -1)}
                      aria-label={`Move ${definition.label} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-9"
                      disabled={index === preferences.widgets.length - 1}
                      onClick={() => onMove(widget.id, 1)}
                      aria-label={`Move ${definition.label} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-9"
                      disabled={definition.required}
                      onClick={() => onToggle(widget.id)}
                      title={
                        definition.required
                          ? 'This card cannot be hidden'
                          : widget.visible
                            ? 'Hide this card'
                            : 'Show this card'
                      }
                      aria-label={
                        widget.visible
                          ? `Hide ${definition.label}`
                          : `Show ${definition.label}`
                      }
                      aria-pressed={widget.visible}
                    >
                      {widget.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => void resetAll()} disabled={isResetting}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
