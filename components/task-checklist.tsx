"use client";

import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface TaskChecklistProps {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onAdd?: (title: string) => void;
}

export function TaskChecklist({ tasks, onToggle, onAdd }: TaskChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  return (
    <div className="space-y-2">
      {sorted.map((task) => {
        const overdue = task.dueDate && !task.done && daysUntil(task.dueDate) < 0;
        return (
          <div
            key={task.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3.5 transition-colors",
              task.done && "opacity-55",
            )}
          >
            <Checkbox
              checked={task.done}
              onCheckedChange={() => onToggle(task.id)}
              aria-label={`Mark "${task.title}" ${task.done ? "incomplete" : "complete"}`}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-sm font-medium", task.done && "line-through")}>
                  {task.title}
                </span>
                {task.category && (
                  <Badge variant="secondary" className="text-[10px]">
                    {task.category}
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.description}</p>
              )}
              {task.dueDate && (
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1 text-xs",
                    overdue ? "text-red-400" : "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {overdue ? "Was due" : "Due"} {formatDate(task.dueDate)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {onAdd && (
        <form
          className="flex gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) {
              onAdd(newTitle.trim());
              setNewTitle("");
            }
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add your own task…"
            aria-label="New task title"
          />
          <Button type="submit" variant="secondary" size="icon" aria-label="Add task">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
