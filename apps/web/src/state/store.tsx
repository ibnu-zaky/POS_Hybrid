// state/store.tsx — useReducer + Context + persist + bus
import { useReducer, useEffect, type ReactNode } from "react";
import { type AppState, getSeedState } from "../data/seed";
import { loadJSON, saveJSON } from "../lib/storage";
import { broadcast, onBroadcast } from "../lib/bus";
import { StoreContext, type StoreAction } from "./store-context";

const STORAGE_KEY = "wk-state-v1";

function reducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case "SET_STATE":
      return action.payload;
    case "ADD_ORDER":
      return { ...state, orders: [...state.orders, action.payload], nextOrderId: action.payload.id + 1 };
    case "UPDATE_ORDER":
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.payload.id ? { ...o, ...action.payload.patch } : o)),
      };
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, action.payload] };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) => (p.id === action.payload.id ? { ...p, ...action.payload.patch } : p)),
      };
    case "DELETE_PRODUCT":
      return { ...state, products: state.products.filter((p) => p.id !== action.payload) };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.payload] };
    case "UPDATE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((c) => (c.id === action.payload.id ? { ...c, ...action.payload.patch } : c)),
      };
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((c) => c.id !== action.payload) };
    case "REORDER_CATEGORY": {
      const sorted = [...state.categories].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === action.payload.id);
      const swapWith = idx + action.payload.dir;
      if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return state;
      [sorted[idx].order, sorted[swapWith].order] = [sorted[swapWith].order, sorted[idx].order];
      return { ...state, categories: sorted };
    }
    case "ADD_TABLE":
      return { ...state, tables: [...state.tables, action.payload] };
    case "DELETE_TABLE":
      return { ...state, tables: state.tables.filter((t) => t.id !== action.payload) };
    case "REGENERATE_TOKEN":
      return {
        ...state,
        tables: state.tables.map((t) =>
          t.id === action.payload
            ? { ...t, token: Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("") }
            : t
        ),
      };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
}

function initState(): AppState {
  const saved = loadJSON<AppState | null>(STORAGE_KEY, null);
  return saved || getSeedState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  // persist
  useEffect(() => {
    const ok = saveJSON(STORAGE_KEY, state);
    if (!ok) {
      console.warn("Memori peramban penuh, perubahan belum tersimpan permanen");
    }
  }, [state]);

  // broadcast perubahan
  useEffect(() => {
    broadcast("state", state);
  }, [state]);

  // terima broadcast dari tab lain + storage event
  useEffect(() => {
    const off = onBroadcast((msg) => {
      if (msg.type === "state" && msg.payload) {
        dispatch({ type: "SET_STATE", payload: msg.payload as AppState });
      }
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          dispatch({ type: "SET_STATE", payload: JSON.parse(e.newValue) });
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}
