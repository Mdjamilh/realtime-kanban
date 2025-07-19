import { useSyncExternalStore } from "react";

export type Route = { page: "home" } | { page: "board"; id: string };

const BOARD = /^#\/b\/([A-Za-z0-9_-]{1,64})$/;

/** Hash routes (#/b/<id>) work on any static host without rewrite rules. */
export function parseRoute(hash: string): Route {
  const match = BOARD.exec(hash);
  return match ? { page: "board", id: match[1]! } : { page: "home" };
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}

export const boardHref = (id: string) => `#/b/${id}`;

export function navigate(href: string) {
  window.location.hash = href.replace(/^#/, "");
}
