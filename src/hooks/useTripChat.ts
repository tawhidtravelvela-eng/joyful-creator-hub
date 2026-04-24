/**
 * useTripChat — manages chat messages, conversation history, and input state
 * for the Trip Planner. Extracted from TripPlanner.tsx for maintainability.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import type { Msg, LiveData, Itinerary, ConversationEntry } from "@/components/trip-planner/tripTypes";
import {
  loadCachedMessages, saveCachedMessages,
  loadCachedLiveData, saveCachedLiveData,
  loadCachedItinerary, saveCachedItinerary,
  loadHistory, saveToHistory, deleteFromHistory,
  CACHE_LIVE_KEY, CACHE_FLIGHTS_KEY, CACHE_HOTELS_KEY,
  CACHE_HOTELS_BY_CITY_KEY, CACHE_ACTIVITIES_KEY, CACHE_ACTIVITIES_BY_CITY_KEY,
  CACHE_EXTRACTED_PARAMS_KEY, CACHE_REFINEMENT_KEY, CACHE_AI_TRAVELERS_KEY,
} from "@/components/trip-planner/tripCacheHelpers";
import { sanitizeMessages, normalizeItinerary, parseItinerary } from "@/components/trip-planner/tripParsingUtils";

export interface UseTripChatReturn {
  // Chat state
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  messagesRef: React.MutableRefObject<Msg[]>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLTextAreaElement>;

  // History
  history: ConversationEntry[];
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  handleLoadConversation: (entry: ConversationEntry) => void;
  handleDeleteConversation: (id: string) => void;

  // Live data & itinerary persistence
  lastLiveData: LiveData;
  setLastLiveData: React.Dispatch<React.SetStateAction<LiveData>>;
  structuredItinerary: Itinerary | null;
  setStructuredItinerary: React.Dispatch<React.SetStateAction<Itinerary | null>>;

  // New trip
  handleNewTrip: (resetSearchState: () => void) => void;
}

export function useTripChat(): UseTripChatReturn {
  const [messages, setMessages] = useState<Msg[]>(() => loadCachedMessages());
  const messagesRef = useRef<Msg[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [lastLiveData, setLastLiveData] = useState<LiveData>(() => loadCachedLiveData());
  const [structuredItinerary, setStructuredItinerary] = useState<Itinerary | null>(() => loadCachedItinerary());

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ConversationEntry[]>(() => loadHistory());

  // Keep ref in sync and persist to localStorage
  useEffect(() => {
    messagesRef.current = messages;
    saveCachedMessages(messages);
  }, [messages]);

  useEffect(() => {
    saveCachedItinerary(structuredItinerary);
  }, [structuredItinerary]);

  const handleLoadConversation = useCallback((entry: ConversationEntry) => {
    const rawMessages = Array.isArray(entry.messages) ? entry.messages : [];
    const safeMessages = sanitizeMessages(rawMessages);
    const entryItinerary = entry.itinerary
      ? normalizeItinerary(entry.itinerary)
      : (() => {
          for (let i = rawMessages.length - 1; i >= 0; i--) {
            if (rawMessages[i]?.role === "assistant") {
              const parsed = parseItinerary(rawMessages[i].content);
              if (parsed) return parsed;
            }
          }
          return null;
        })();

    setMessages(safeMessages);
    setLastLiveData(entry.liveData);
    setStructuredItinerary(entryItinerary);
    saveCachedMessages(safeMessages);
    saveCachedItinerary(entryItinerary);
    if (entry.liveData) saveCachedLiveData(entry.liveData);
    setShowHistory(false);
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteFromHistory(id);
    setHistory(loadHistory());
  }, []);

  const handleNewTrip = useCallback((resetSearchState: () => void) => {
    // Save current conversation to history before clearing
    if (messages.length > 1) {
      saveToHistory(messages, lastLiveData, structuredItinerary);
      setHistory(loadHistory());
    }
    // Clear chat state
    setMessages([]);
    setLastLiveData(null);
    setStructuredItinerary(null);
    setInput("");

    // Clear caches
    saveCachedMessages([]);
    saveCachedItinerary(null);
    localStorage.removeItem(CACHE_LIVE_KEY);
    localStorage.removeItem(CACHE_EXTRACTED_PARAMS_KEY);
    localStorage.removeItem(CACHE_REFINEMENT_KEY);
    localStorage.removeItem(CACHE_AI_TRAVELERS_KEY);
    sessionStorage.removeItem(CACHE_FLIGHTS_KEY);
    sessionStorage.removeItem(CACHE_HOTELS_KEY);
    sessionStorage.removeItem(CACHE_HOTELS_BY_CITY_KEY);
    sessionStorage.removeItem(CACHE_ACTIVITIES_KEY);
    sessionStorage.removeItem(CACHE_ACTIVITIES_BY_CITY_KEY);

    // Delegate search-specific state reset to caller
    resetSearchState();
  }, [messages, lastLiveData, structuredItinerary]);

  return {
    messages, setMessages, messagesRef,
    input, setInput, inputRef,
    history, showHistory, setShowHistory,
    handleLoadConversation, handleDeleteConversation,
    lastLiveData, setLastLiveData,
    structuredItinerary, setStructuredItinerary,
    handleNewTrip,
  };
}
