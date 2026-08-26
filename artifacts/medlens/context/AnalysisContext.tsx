import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  analyzeAilment,
  getAnalysisJob,
  type AnalysisResult,
  type AnalyzeAilmentBody,
  type DisciplinePerspective,
  type FollowupAnswer,
} from "@workspace/api-client-react";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes max

async function startAndPoll(body: AnalyzeAilmentBody): Promise<AnalysisResult> {
  const { jobId } = await analyzeAilment(body);
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const job = await getAnalysisJob(jobId);
    if (job.status === "done" && job.result) {
      return job.result as AnalysisResult;
    }
    if (job.status === "error") {
      throw new Error(job.error ?? "Analysis failed on server");
    }
  }

  throw new Error("Analysis timed out. Please try again.");
}

const STORAGE_KEY = "medlens.history.v1";
const MAX_HISTORY = 25;

export type HistoryEntry = {
  id: string;
  createdAt: number;
  ailment: string;
  age?: number | null;
  sex?: string | null;
  history?: string | null;
  mode?: "light" | "standard" | "premium" | null;
  disciplines?: string[] | null;
  result: AnalysisResult;
  followupAnswers: FollowupAnswer[];
};

type AnalysisStatus = "idle" | "loading" | "ready" | "error";

type AnalysisContextValue = {
  status: AnalysisStatus;
  error: string | null;
  current: HistoryEntry | null;
  history: HistoryEntry[];
  setCurrentById: (id: string) => void;
  clearCurrent: () => void;
  startAnalysis: (input: {
    ailment: string;
    age?: number | null;
    sex?: string | null;
    history?: string | null;
    mode?: "light" | "standard" | "premium" | null;
    disciplines?: string[] | null;
    imageBase64?: string | null;
    imageMimeType?: string | null;
    labResults?: string | null;
  }) => Promise<HistoryEntry | null>;
  refineWithAnswers: (
    newAnswers: FollowupAnswer[],
    media?: { imageBase64?: string | null; imageMimeType?: string | null; labResults?: string | null },
  ) => Promise<void>;
  removeFromHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as HistoryEntry[];
          if (Array.isArray(parsed)) setHistory(parsed);
        } catch {
          // ignore malformed history
        }
      })
      .catch(() => {
        // ignore storage failures
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: HistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage failures are non-fatal
    }
  }, []);

  const startAnalysis = useCallback<
    AnalysisContextValue["startAnalysis"]
  >(
    async (input) => {
      const ailment = input.ailment.trim();
      if (!ailment) {
        setError("Please describe what you're experiencing.");
        setStatus("error");
        return null;
      }
      setStatus("loading");
      setError(null);
      setCurrentId(null);
      try {
        const body: AnalyzeAilmentBody = {
          ailment,
          age: input.age ?? null,
          sex: input.sex ?? null,
          history: input.history ?? null,
          followupAnswers: [],
          mode: input.mode ?? "premium",
          disciplines: input.disciplines ?? null,
          imageBase64: input.imageBase64 ?? null,
          imageMimeType: input.imageMimeType ?? null,
          labResults: input.labResults ?? null,
        };
        const result = await startAndPoll(body);
        const entry: HistoryEntry = {
          id: makeId(),
          createdAt: Date.now(),
          ailment,
          age: input.age ?? null,
          sex: input.sex ?? null,
          history: input.history ?? null,
          mode: input.mode ?? null,
          disciplines: input.disciplines ?? null,
          followupAnswers: [],
          result,
        };
        const next = [entry, ...history].slice(0, MAX_HISTORY);
        setHistory(next);
        setCurrentId(entry.id);
        setStatus("ready");
        await persist(next);
        return entry;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not reach the analysis service.";
        setError(message);
        setStatus("error");
        return null;
      }
    },
    [history, persist],
  );

  const refineWithAnswers = useCallback<
    AnalysisContextValue["refineWithAnswers"]
  >(
    async (newAnswers, media) => {
      const entry = history.find((h) => h.id === currentId);
      if (!entry) return;
      setStatus("loading");
      setError(null);
      try {
        const merged = mergeAnswers(entry.followupAnswers, newAnswers);
        const body: AnalyzeAilmentBody = {
          ailment: entry.ailment,
          age: entry.age ?? null,
          sex: entry.sex ?? null,
          history: entry.history ?? null,
          followupAnswers: merged,
          mode: entry.mode ?? null,
          disciplines: entry.disciplines ?? null,
          imageBase64: media?.imageBase64 ?? null,
          imageMimeType: media?.imageMimeType ?? null,
          labResults: media?.labResults ?? null,
        };
        const result = await startAndPoll(body);
        const updated: HistoryEntry = {
          ...entry,
          followupAnswers: merged,
          result,
        };
        const next = history.map((h) => (h.id === entry.id ? updated : h));
        setHistory(next);
        setStatus("ready");
        await persist(next);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not refine the analysis.";
        setError(message);
        setStatus("error");
      }
    },
    [currentId, history, persist],
  );

  const setCurrentById = useCallback((id: string) => {
    setCurrentId(id);
    setStatus("ready");
    setError(null);
  }, []);

  const clearCurrent = useCallback(() => {
    setCurrentId(null);
    setStatus("idle");
    setError(null);
  }, []);

  const removeFromHistory = useCallback<
    AnalysisContextValue["removeFromHistory"]
  >(
    async (id) => {
      const next = history.filter((h) => h.id !== id);
      setHistory(next);
      if (currentId === id) {
        setCurrentId(null);
        setStatus("idle");
      }
      await persist(next);
    },
    [currentId, history, persist],
  );

  const clearHistory = useCallback<AnalysisContextValue["clearHistory"]>(async () => {
    setHistory([]);
    setCurrentId(null);
    setStatus("idle");
    await persist([]);
  }, [persist]);

  const current = useMemo(
    () => history.find((h) => h.id === currentId) ?? null,
    [history, currentId],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      status,
      error,
      current,
      history,
      setCurrentById,
      clearCurrent,
      startAnalysis,
      refineWithAnswers,
      removeFromHistory,
      clearHistory,
    }),
    [
      status,
      error,
      current,
      history,
      setCurrentById,
      clearCurrent,
      startAnalysis,
      refineWithAnswers,
      removeFromHistory,
      clearHistory,
    ],
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return ctx;
}

function mergeAnswers(
  existing: FollowupAnswer[],
  incoming: FollowupAnswer[],
): FollowupAnswer[] {
  const map = new Map<string, FollowupAnswer>();
  for (const a of existing) {
    map.set(`${a.disciplineId}::${a.question}`, a);
  }
  for (const a of incoming) {
    map.set(`${a.disciplineId}::${a.question}`, a);
  }
  return Array.from(map.values());
}

export type { DisciplinePerspective };
