import React from 'react';
import { Plus, X, GripVertical, Network } from 'lucide-react';
import { RuleGroup, RuleCondition, RuleKind } from '../../types/campaign';
import { cn } from '../../lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RulesBuilderProps {
  ruleTree: RuleGroup;
  setRuleTree: React.Dispatch<React.SetStateAction<RuleGroup>>;
}

const updateGroup = (root: RuleGroup, groupId: string, updater: (group: RuleGroup) => RuleGroup): RuleGroup => {
  if (root.id === groupId) return updater(root);
  return {
    ...root,
    children: root.children.map((child) =>
      child.type === 'group' ? updateGroup(child, groupId, updater) : child
    ),
  };
};

const newGroup = (): RuleGroup => ({ id: crypto.randomUUID(), type: 'group', operator: 'and', children: [] });
const newCondition = (): RuleCondition => ({ id: crypto.randomUUID(), type: 'condition', kind: 'url_contains', operator: 'include', value: '' });

const SortableCondition = ({
  condition,
  onUpdate,
  onDelete,
}: {
  condition: RuleCondition;
  onUpdate: (updates: Partial<RuleCondition>) => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: condition.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 transition-colors",
        isDragging && "opacity-50 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded text-slate-400">
        <GripVertical className="w-4 h-4" />
      </div>

      <select
        value={condition.kind}
        onChange={(e) => onUpdate({ kind: e.target.value as RuleKind })}
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-40"
      >
        <optgroup label="General">
          <option value="url_contains">URL contains</option>
          <option value="url_exact">URL exact</option>
          <option value="url_regex">URL regex</option>
          <option value="device">Device</option>
          <option value="returning_visitor">Returning visitor</option>
        </optgroup>
        <optgroup label="Triggers">
          <option value="time_on_site">Time on site (s)</option>
          <option value="idle_time">Idle time (s)</option>
          <option value="scroll_depth">Scroll depth (%)</option>
          <option value="exit_intent">Exit intent</option>
          <option value="browser_back">Browser back</option>
          <option value="custom_js">Custom JS</option>
        </optgroup>
        <optgroup label="Advanced Targeting">
          <option value="browser_language">Browser language</option>
          <option value="referring_website">Referring website</option>
          <option value="visit_count">Visit count</option>
          <option value="page_view_count">Page view count</option>
          <option value="visited_page_count">Visited page count</option>
          <option value="not_seen_page">Not seen page</option>
          <option value="previously_viewed">Previously viewed</option>
          <option value="has_clicked_button">Clicked button ID/Class</option>
          <option value="is_subscriber">Is subscriber (true/false)</option>
          <option value="country_state">Country/State</option>
          <option value="block_ip">Block IP</option>
        </optgroup>
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as 'include' | 'exclude' })}
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-28"
      >
        <option value="include">Include</option>
        <option value="exclude">Exclude</option>
      </select>

      <input
        value={condition.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Value"
        className="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500"
      />

      <button
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const RecursiveGroup = ({
  group,
  depth = 0,
  onUpdateTree,
  isRoot = false,
}: {
  group: RuleGroup;
  depth?: number;
  onUpdateTree: (updater: (g: RuleGroup) => RuleGroup) => void;
  isRoot?: boolean;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onUpdateTree((root) => {
        return updateGroup(root, group.id, (g) => {
          const oldIndex = g.children.findIndex((c) => c.id === active.id);
          const newIndex = g.children.findIndex((c) => c.id === over.id);
          return { ...g, children: arrayMove(g.children, oldIndex, newIndex) };
        });
      });
    }
  };

  const handleAddCondition = () => {
    onUpdateTree((root) =>
      updateGroup(root, group.id, (g) => ({ ...g, children: [...g.children, newCondition()] }))
    );
  };

  const handleAddGroup = () => {
    onUpdateTree((root) =>
      updateGroup(root, group.id, (g) => ({ ...g, children: [...g.children, newGroup()] }))
    );
  };

  const handleDeleteSelf = () => {
    if (isRoot) return;
    onUpdateTree((root) => {
      // Find parent of this group and remove it. A simpler way is to filter children everywhere
      const removeNode = (node: RuleGroup): RuleGroup => {
        return {
          ...node,
          children: node.children.filter((c) => c.id !== group.id).map((c) => (c.type === 'group' ? removeNode(c) : c)),
        };
      };
      return removeNode(root);
    });
  };

  const bgColors = [
    'bg-slate-50 dark:bg-slate-900/50',
    'bg-indigo-50/50 dark:bg-indigo-900/20',
    'bg-violet-50/50 dark:bg-violet-900/20',
  ];
  const bgColor = bgColors[Math.min(depth, bgColors.length - 1)];

  return (
    <div className={cn("rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4", bgColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isRoot && <Network className="w-4 h-4 text-slate-400" />}
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {isRoot ? 'Root Group' : `Nested Group`}
          </span>
          <select
            value={group.operator}
            onChange={(e) =>
              onUpdateTree((root) =>
                updateGroup(root, group.id, (g) => ({ ...g, operator: e.target.value as 'and' | 'or' }))
              )
            }
            className={cn(
              "ml-2 text-xs font-bold px-2 py-1 rounded-md border outline-none",
              group.operator === 'and'
                ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30"
                : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30"
            )}
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddCondition}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Condition
          </button>
          <button
            onClick={handleAddGroup}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 transition-colors"
          >
            <Network className="w-3.5 h-3.5" /> Group
          </button>
          {!isRoot && (
            <button
              onClick={handleDeleteSelf}
              className="p-1.5 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-3 relative">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={group.children.filter((c) => c.type === 'condition').map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {group.children.map((child, index) => {
              if (child.type === 'condition') {
                return (
                  <SortableCondition
                    key={child.id}
                    condition={child}
                    onUpdate={(updates) =>
                      onUpdateTree((root) =>
                        updateGroup(root, group.id, (g) => ({
                          ...g,
                          children: g.children.map((c) => (c.id === child.id ? ({ ...c, ...updates } as RuleCondition) : c)),
                        }))
                      )
                    }
                    onDelete={() =>
                      onUpdateTree((root) =>
                        updateGroup(root, group.id, (g) => ({
                          ...g,
                          children: g.children.filter((c) => c.id !== child.id),
                        }))
                      )
                    }
                  />
                );
              }
              return (
                <RecursiveGroup
                  key={child.id}
                  group={child}
                  depth={depth + 1}
                  onUpdateTree={onUpdateTree}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        
        {group.children.length === 0 && (
          <div className="py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center">
            <p className="text-xs text-slate-400">Empty group. Add a condition or nested group.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const RulesBuilder: React.FC<RulesBuilderProps> = ({ ruleTree, setRuleTree }) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Targeting Rules</h2>
        <p className="text-xs text-slate-500">Build advanced nested rules to precisely target your audience.</p>
      </div>
      <RecursiveGroup group={ruleTree} onUpdateTree={setRuleTree} isRoot={true} />
    </div>
  );
};
