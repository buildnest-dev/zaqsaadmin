import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isPending, watchRequests, type LoginRequest } from "../lib/loginRequests";

type Value = { requests: LoginRequest[]; pending: LoginRequest[]; error: string; loaded: boolean };
const Ctx = createContext<Value>({ requests: [], pending: [], error: "", loaded: false });
export const useRequests = () => useContext(Ctx);

const BASE_TITLE = "ZAQSA Admin";

function beep() {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(audio.currentTime + 0.25);
  } catch {
    /* sound is optional */
  }
}

/** Watches team sign-in requests while an admin is signed in, and alerts when a new one arrives. */
export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<LoginRequest[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seen = useRef<Set<string> | null>(null);

  useEffect(
    () =>
      watchRequests(
        (list) => {
          setRequests(list);
          setLoaded(true);
          setError("");
        },
        (message) => setError(message),
      ),
    [],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const pending = useMemo(() => requests.filter((r) => isPending(r, now)), [requests, now]);

  // Alert only for requests that arrive after the page was opened.
  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      seen.current = new Set(pending.map((r) => r.id));
      return;
    }
    const fresh = pending.filter((r) => !seen.current!.has(r.id));
    fresh.forEach((r) => seen.current!.add(r.id));
    if (fresh.length === 0) return;
    beep();
    if ("Notification" in window && Notification.permission === "granted") {
      const first = fresh[0]!;
      new Notification("Team sign-in request", { body: `${first.name || first.email} wants to sign in` });
    }
  }, [pending, loaded]);

  useEffect(() => {
    document.title = pending.length ? `(${pending.length}) Sign-in request · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [pending.length]);

  return <Ctx.Provider value={{ requests, pending, error, loaded }}>{children}</Ctx.Provider>;
}
