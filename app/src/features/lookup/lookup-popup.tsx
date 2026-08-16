import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { BookOpen, ExternalLink, ImageIcon, Loader2, Save, SearchX, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Toaster } from "@/components/shared/toaster";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import {
  closeLookupPopup,
  getCurrentLookupStatus,
  openLookupDetails,
  saveLookupResult,
  type LookupResult,
} from "@/services/lookup-service";
import { useToastStore } from "@/stores/toast-store";

export function LookupPopup() {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedResultKey, setSavedResultKey] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeQuery, setActiveQuery] = useState(() => initialQueryFromHash());
  const [error, setError] = useState<string | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    void getCurrentLookupStatus()
      .then((currentStatus) => {
        applyLookupStatus(currentStatus, setActiveQuery, setResult, setError, setStatus);
      })
      .catch(() => setStatus("loading"));

    const unlistenStarted = listen<string>("lookup_started", (event) => {
      setActiveQuery(event.payload);
      setResult(null);
      setSavedResultKey(null);
      setError(null);
      setStatus("loading");
    });

    const unlisten = listen<LookupResult>("lookup_result_ready", (event) => {
      setError(null);
      setActiveQuery(event.payload.query);
      setResult(event.payload);
      setSavedResultKey(null);
      setStatus("ready");
    });

    const unlistenFailed = listen<string>("lookup_failed", (event) => {
      setResult(null);
      setError(event.payload);
      setStatus("error");
    });

    return () => {
      void unlistenStarted.then((callback) => callback());
      void unlisten.then((callback) => callback());
      void unlistenFailed.then((callback) => callback());
    };
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const popupWidth = Math.min(640, Math.max(560, window.screen.availWidth - 48));
      const contentHeight = Math.ceil(document.documentElement.scrollHeight);
      const popupHeight = Math.min(
        Math.max(contentHeight, status === "ready" ? 640 : 360),
        Math.max(560, window.screen.availHeight - 96),
      );
      const left = Math.max(16, window.screen.availWidth - popupWidth - 24);
      const top = 72;
      const popup = getCurrentWindow();

      void popup.setSize(new LogicalSize(popupWidth, popupHeight));
      void popup.setPosition(new LogicalPosition(left, top));
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [result, status]);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    // O popup pode abrir antes do provider terminar, polling para assim que o resultado chega
    const interval = window.setInterval(() => {
      void getCurrentLookupStatus()
        .then((currentStatus) => {
          const hasNewQuery = Boolean(currentStatus.query) && currentStatus.query !== activeQuery;
          const currentResultKey = currentStatus.result
            ? lookupResultKey(currentStatus.result)
            : null;
          const displayedResultKey = result ? lookupResultKey(result) : null;
          const hasNewResult = Boolean(currentResultKey) && currentResultKey !== displayedResultKey;

          if (
            status === "loading" ||
            currentStatus.is_loading ||
            currentStatus.error ||
            hasNewQuery ||
            hasNewResult
          ) {
            applyLookupStatus(currentStatus, setActiveQuery, setResult, setError, setStatus);
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => window.clearInterval(interval);
  }, [activeQuery, result, status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void closeLookupPopup();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSave() {
    if (!result) {
      return;
    }

    try {
      setIsSaving(true);
      await saveLookupResult(result);
      setSavedResultKey(lookupResultKey(result));
      addToast({
        variant: "success",
        title: "Salvo com sucesso",
        description: "Agora você pode abrir os detalhes ou encontrar este item na Biblioteca.",
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Não foi possível salvar",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDetails() {
    if (!result) {
      return;
    }

    try {
      setIsSaving(true);
      await openLookupDetails(result);
    } finally {
      setIsSaving(false);
    }
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <ErrorState message={userMessage(error ?? "Não foi possível concluir a consulta.")} />
      </main>
    );
  }

  if (status === "loading" || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="surface w-full max-w-sm p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold">Consultando contexto</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeQuery || "Preparando texto reconhecido..."}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isEmptyLookupResult(result)) {
    return (
      <main className="min-h-screen overflow-auto bg-background p-4 text-foreground">
        <EmptyState
          icon={SearchX}
          title="Nenhum resultado util encontrado"
          description="A consulta foi concluída, mas não trouxe tradução ou contexto suficiente. Confira o texto capturado e tente novamente."
        />
        <section className="surface mt-4 p-4">
          <p className="text-xs text-muted-foreground">Texto capturado</p>
          <p className="mt-1 text-sm leading-6">{result.query}</p>
        </section>
        {visibleWarning(result.warnings) ? (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            {visibleWarning(result.warnings)}
          </p>
        ) : null}
      </main>
    );
  }

  const contextTranslation = result.contextual_explanation_translation ?? result.translation;
  const meaningTranslation = result.meaning_translation ?? null;
  const isPhrase = result.query.trim().split(/\s+/).filter(Boolean).length > 1;
  const shouldShowReferenceImage =
    isVisualLookupCandidate(result.word) && result.reference_image_url;
  const isCurrentResultSaved = savedResultKey === lookupResultKey(result);

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Consulta contextual</p>
            <h1 className="mt-1 truncate text-xl font-medium">{result.word}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void closeLookupPopup()}
            title="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <section className="surface p-4">
          <p className="text-xs text-muted-foreground">
            {isPhrase ? "Frase original" : "Texto capturado"}
          </p>
          <p className="mt-1 text-sm leading-6">{result.query}</p>
        </section>

        <section className="surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Tradução</p>
              <p className="mt-1 text-lg font-medium">{result.translation}</p>
              {result.part_of_speech ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Classe gramatical: {translatePartOfSpeech(result.part_of_speech)}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {shouldShowReferenceImage ? (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Imagem de Referência</h2>
            </div>
            <div className="surface max-w-xs overflow-hidden">
              <img
                className="aspect-[4/3] max-h-40 w-full object-cover"
                src={result.reference_image_url ?? undefined}
                alt={`Imagem de Referência para ${result.word}`}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.closest("section")?.remove();
                }}
              />
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Sentido no contexto</h2>
          </div>
          <div className="surface p-3 text-sm leading-6">
            <p className="font-medium text-foreground">{result.contextual_explanation}</p>
            <p className="mt-2 text-muted-foreground">{contextTranslation}</p>
          </div>
          <div className="surface p-3 text-sm leading-6">
            <p className="font-medium text-foreground">{result.meaning}</p>
            {meaningTranslation ? (
              <p className="mt-2 text-muted-foreground">{meaningTranslation}</p>
            ) : null}
          </div>
        </section>

        {result.examples.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Exemplos</h2>
            {result.examples.map((example) => (
              <div key={example.original_text} className="surface p-3 text-sm">
                <p>{example.original_text}</p>
                {example.translated_text ? (
                  <p className="mt-1 text-muted-foreground">{example.translated_text}</p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {visibleWarning(result.warnings) ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            {visibleWarning(result.warnings)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          {isCurrentResultSaved ? (
            <p className="mr-auto self-center text-xs text-muted-foreground">
              Item salvo. Você já pode abrir os detalhes.
            </p>
          ) : null}
          <Button variant="outline" onClick={handleDetails} isLoading={isSaving}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Detalhes
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save className="size-4" aria-hidden="true" />
            Salvar
          </Button>
        </div>
      </div>
      <Toaster />
    </main>
  );
}

function visibleWarning(warnings: string[]) {
  const warning = warnings.find(
    (warning) =>
      !warning.includes("interpretar a resposta completa da IA") && !warning.includes("campo word"),
  );

  return warning ? userMessage(warning) : undefined;
}

function isEmptyLookupResult(result: LookupResult) {
  const normalizedTranslation = normalizeText(result.translation);

  return (
    normalizedTranslation === "tradução indisponível" ||
    normalizedTranslation === "tradução indisponível"
  );
}

function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

function isPhraseText(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length > 1;
}

function isVisualLookupCandidate(text: string) {
  const normalized = normalizeText(text);
  return normalized.length >= 3 && !isPhraseText(normalized) && !nonVisualWords.has(normalized);
}

const nonVisualWords = new Set([
  "the",
  "and",
  "because",
  "should",
  "would",
  "could",
  "time",
  "ago",
  "meaning",
  "context",
  "thing",
  "idea",
]);

function translatePartOfSpeech(value: string) {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    adjective: "adjetivo",
    adverb: "adverbio",
    conjunction: "conjuncao",
    determiner: "determinante",
    interjection: "interjeicao",
    noun: "substantivo",
    number: "numero",
    preposition: "preposicao",
    pronoun: "pronome",
    verb: "verbo",
  };

  return labels[normalized] ?? value;
}

function lookupResultKey(result: LookupResult) {
  // Chave simples para diferenciar consultas novas sem depender de id ainda nao salvo
  return `${result.query}\u0000${result.word}\u0000${result.translation}\u0000${result.source}`;
}

function initialQueryFromHash() {
  const queryString = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(queryString).get("query") ?? "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function applyLookupStatus(
  currentStatus: {
    query: string | null;
    result: LookupResult | null;
    error: string | null;
    is_loading: boolean;
  },
  setActiveQuery: (query: string) => void,
  setResult: (result: LookupResult | null) => void,
  setError: (error: string | null) => void,
  setStatus: (status: "loading" | "ready" | "error") => void,
) {
  if (currentStatus.query) {
    setActiveQuery(currentStatus.query);
  }

  if (currentStatus.result) {
    setResult(currentStatus.result);
    setError(null);
    setStatus("ready");
    return;
  }

  if (currentStatus.error) {
    setError(currentStatus.error);
    setStatus("error");
    return;
  }

  if (currentStatus.is_loading) {
    setStatus("loading");
  }
}
