import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowDownAZ,
  BookMarked,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StateView } from "@/components/shared/state-view";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import { cn } from "@/lib/utils";
import { searchWords, type WordListItem, type WordSort } from "@/services/database-service";
import { useNavigationStore } from "@/stores/navigation-store";
import { useVocabularyStore } from "@/stores/vocabulary-store";

const PAGE_SIZE = 20;

const sortOptions: Array<{ value: WordSort; label: string }> = [
  { value: "last_lookup", label: "Última consulta" },
  { value: "alphabetical", label: "A-Z" },
  { value: "created_at", label: "Mais recentes" },
];

export function VocabularyPage() {
  const { query, sort, refreshToken, setQuery, setSort, requestRefresh } = useVocabularyStore();
  const [items, setItems] = useState<WordListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);
  const setSelectedWordId = useNavigationStore((state) => state.setSelectedWordId);

  const normalizedQuery = useMemo(() => query.trim().replace(/\s+/g, " "), [query]);
  const hasMore = items.length < total;

  const loadWords = useCallback(
    async ({ append, offset }: { append: boolean; offset: number }) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setStatus("loading");
      }

      setError(null);

      try {
        const response = await searchWords({
          query: normalizedQuery || undefined,
          sort,
          limit: PAGE_SIZE,
          offset,
        });

        setItems((currentItems) =>
          append ? [...currentItems, ...response.items] : response.items,
        );
        setTotal(response.total);
        setStatus("ready");
      } catch (err) {
        setError(userMessage(errorMessage(err)));
        setStatus("error");
      } finally {
        setIsLoadingMore(false);
      }
    },
    [normalizedQuery, sort],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWords({ append: false, offset: 0 });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [loadWords, refreshToken]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const unlistenSaved = listen("lookup_saved", () => {
      requestRefresh();
    });
    const unlistenDetails = listen("lookup_details_requested", () => {
      requestRefresh();
    });

    return () => {
      void unlistenSaved.then((unlisten) => unlisten());
      void unlistenDetails.then((unlisten) => unlisten());
    };
  }, [requestRefresh]);

  useEffect(() => {
    if (!isSortOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSortOpen]);

  function openWord(wordId: string) {
    setSelectedWordId(wordId);
    setCurrentView("word");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field w-full pl-9"
            placeholder="Pesquisar por palavra ou tradução"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>

        <div ref={sortMenuRef} className="relative">
          <button
            className={cn(
              "surface-soft flex h-9 min-w-44 items-center gap-2 px-3 text-sm transition-colors",
              "hover:border-primary/35 hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSortOpen && "border-primary/40 bg-accent text-accent-foreground",
            )}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isSortOpen}
            aria-label="Ordenar biblioteca"
            onClick={() => setIsSortOpen((current) => !current)}
          >
            <ArrowDownAZ className="size-4 shrink-0 text-current opacity-75" aria-hidden="true" />
            <span className="flex-1 text-left">
              {sortOptions.find((option) => option.value === sort)?.label ?? "Ordenar"}
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-current opacity-70 transition-transform", {
                "rotate-180": isSortOpen,
              })}
              aria-hidden="true"
            />
          </button>

          {isSortOpen ? (
            <div
              className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
              role="listbox"
              aria-label="Ordenar biblioteca"
            >
              {sortOptions.map((option) => {
                const isSelected = option.value === sort;

                return (
                  <button
                    key={option.value}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left transition-colors",
                      "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                      isSelected && "bg-accent text-accent-foreground",
                    )}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSort(option.value);
                      setIsSortOpen(false);
                    }}
                  >
                    <span className="flex-1">{option.label}</span>
                    {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {status === "loading" ? <VocabularySkeleton /> : null}

      {status === "error" ? (
        <StateView
          icon={BookMarked}
          title="Não foi possível carregar"
          description={error ?? "Tente abrir a biblioteca novamente."}
          actionLabel="Tentar novamente"
          onAction={() => void loadWords({ append: false, offset: 0 })}
        />
      ) : null}

      {status === "ready" && items.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={normalizedQuery ? "Nenhum resultado encontrado" : "Nenhuma palavra salva ainda"}
          description={
            normalizedQuery
              ? "Revise a pesquisa ou procure pela tradução cadastrada."
              : "As palavras salvas pelo popup aparecem aqui com tradução, contexto e histórico."
          }
        />
      ) : null}

      {status === "ready" && items.length > 0 ? (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {items.length} de {total} {total === 1 ? "registro" : "registros"}
            </span>
            {normalizedQuery ? <span>Pesquisa: {normalizedQuery}</span> : null}
          </div>

          <div className="surface overflow-hidden">
            {items.map((word) => (
              <button
                key={word.id}
                className="interactive-surface w-full border-b p-4 text-left text-card-foreground last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={() => openWord(word.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-medium">{word.term}</h2>
                    <p className="mt-1 text-sm">
                      {word.main_translation ?? "Tradução não registrada"}
                    </p>
                    {word.latest_context ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {word.latest_context}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "rounded bg-muted px-2 py-1 font-medium",
                        word.status === "known" && "text-primary",
                      )}
                    >
                      {statusLabel(word.status)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {word.lookups_count} {word.lookups_count === 1 ? "consulta" : "consultas"}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      {formatDate(word.last_lookup_at ?? word.updated_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                isLoading={isLoadingMore}
                onClick={() => void loadWords({ append: true, offset: items.length })}
              >
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function VocabularySkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-md border bg-card p-4">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="mt-3 h-4 w-36 rounded bg-muted" />
          <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Nova",
    learning: "Estudando",
    difficult: "Difícil",
    known: "Conhecida",
    mastered: "Dominada",
    archived: "Arquivada",
  };

  return labels[status] ?? status;
}

function formatDate(value: string) {
  const date = parseDatabaseDate(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseDatabaseDate(value: string) {
  const sqliteUtcPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  if (sqliteUtcPattern.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
