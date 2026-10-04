"use client";

import { useCallback, useReducer } from "react";
import type { CalendarShiftTarget } from "./utils";

export interface SelectionState {
  targets: CalendarShiftTarget[];
  editor: "quick" | "modal" | null;
  phase: "idle" | "selecting" | "editing" | "saving";
}
export type SelectionAction =
  | { type: "select"; targets: CalendarShiftTarget[] }
  | { type: "editor"; editor: "quick" | "modal"; open: boolean }
  | { type: "drag"; active: boolean }
  | { type: "saving"; active: boolean };

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  if (state.phase === "saving" && action.type !== "saving") return state;
  if (action.type === "select") return { ...state, targets: action.targets };
  if (action.type === "editor") {
    const editor = action.open
      ? action.editor
      : state.editor === action.editor
        ? null
        : state.editor;
    return { ...state, editor, phase: editor ? "editing" : "idle" };
  }
  if (action.type === "drag")
    return {
      ...state,
      phase: action.active ? "selecting" : state.editor ? "editing" : "idle",
    };
  return {
    ...state,
    phase: action.active ? "saving" : state.editor ? "editing" : "idle",
  };
}

export function useCalendarSelection() {
  const [state, dispatch] = useReducer(selectionReducer, {
    targets: [],
    editor: null,
    phase: "idle",
  });
  return {
    selectedTargets: state.targets,
    isAssignModalOpen: state.editor === "modal",
    isQuickAssignOpen: state.editor === "quick",
    isSelectionInteractionActive: state.phase === "selecting",
    isSavingAssignments: state.phase === "saving",
    setSelectedTargets: useCallback(
      (targets: CalendarShiftTarget[]) => dispatch({ type: "select", targets }),
      [],
    ),
    setIsAssignModalOpen: useCallback(
      (open: boolean) => dispatch({ type: "editor", editor: "modal", open }),
      [],
    ),
    setIsQuickAssignOpen: useCallback(
      (open: boolean) => dispatch({ type: "editor", editor: "quick", open }),
      [],
    ),
    setIsSelectionInteractionActive: useCallback(
      (active: boolean) => dispatch({ type: "drag", active }),
      [],
    ),
    setIsSavingAssignments: useCallback(
      (active: boolean) => dispatch({ type: "saving", active }),
      [],
    ),
  };
}
