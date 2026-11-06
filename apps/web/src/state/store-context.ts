import { createContext, useContext } from "react";
import type { AppState } from "../data/seed";

export type StoreAction =
  | { type: "SET_STATE"; payload: AppState }
  | { type: "ADD_ORDER"; payload: AppState["orders"][0] }
  | { type: "UPDATE_ORDER"; payload: { id: number; patch: Partial<AppState["orders"][0]> } }
  | { type: "ADD_PRODUCT"; payload: AppState["products"][0] }
  | { type: "UPDATE_PRODUCT"; payload: { id: number; patch: Partial<AppState["products"][0]> } }
  | { type: "DELETE_PRODUCT"; payload: number }
  | { type: "ADD_CATEGORY"; payload: AppState["categories"][0] }
  | { type: "UPDATE_CATEGORY"; payload: { id: number; patch: Partial<AppState["categories"][0]> } }
  | { type: "DELETE_CATEGORY"; payload: number }
  | { type: "REORDER_CATEGORY"; payload: { id: number; dir: -1 | 1 } }
  | { type: "ADD_TABLE"; payload: AppState["tables"][0] }
  | { type: "DELETE_TABLE"; payload: number }
  | { type: "REGENERATE_TOKEN"; payload: number }
  | { type: "UPDATE_SETTINGS"; payload: Partial<AppState["settings"]> };

type StoreCtx = { state: AppState; dispatch: React.Dispatch<StoreAction> };

export const StoreContext = createContext<StoreCtx | null>(null);

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore harus dipakai di dalam StoreProvider");
  return ctx;
}
