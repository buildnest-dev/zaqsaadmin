import { useCallback, useEffect, useState } from "react";
import { defaultsFor, loadDoc, saveDoc } from "../lib/store";
import type { DocKey, SiteDocs } from "../lib/types";

type State = "loading" | "ready" | "saving" | "saved" | "error";

/** Loads one site document (or the website's built-in content if never saved) for editing. */
export function useSiteDoc<K extends DocKey>(key: K) {
  const [data, setData] = useState<SiteDocs[K] | null>(null);
  const [published, setPublished] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    setState("loading");
    loadDoc(key)
      .then((saved) => {
        if (!live) return;
        setPublished(Boolean(saved));
        setData(saved ?? defaultsFor(key));
        setState("ready");
      })
      .catch((problem: Error) => {
        if (!live) return;
        setMessage(problem.message);
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [key]);

  const update = useCallback((next: SiteDocs[K]) => {
    setData(next);
    setDirty(true);
    setState("ready");
  }, []);

  const save = useCallback(async () => {
    if (!data) return;
    setState("saving");
    try {
      await saveDoc(key, data);
      setPublished(true);
      setDirty(false);
      setState("saved");
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "Could not save.");
      setState("error");
    }
  }, [data, key]);

  const reset = useCallback(() => {
    setData(defaultsFor(key));
    setDirty(true);
  }, [key]);

  return { data, update, save, reset, published, dirty, state, message };
}
