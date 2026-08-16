import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { FileText, Loader2, MessageSquareText, RotateCcw, X } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import { lookupText } from "@/services/lookup-service";
import { closeOcrReview, getCurrentOcrStatus, type OcrResult } from "@/services/ocr-service";

export function OcrReview() {
  const [result, setResult] = useState<OcrResult | null>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeImagePath, setActiveImagePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getCurrentOcrStatus()
      .then((currentStatus) => {
        applyOcrStatus(currentStatus, setResult, setText, setError, setStatus, setActiveImagePath);
      })
      .catch(() => setStatus("loading"));

    const unlistenStarted = listen<string>("ocr_started", (event) => {
      setActiveImagePath(event.payload);
      setResult(null);
      setText("");
      setError(null);
      setStatus("loading");
    });

    const unlisten = listen<OcrResult>("ocr_result_ready", (event) => {
      setError(null);
      setResult(event.payload);
      setText(event.payload.text);
      setActiveImagePath(event.payload.image_path);
      setStatus("ready");
    });

    const unlistenFailed = listen<string>("ocr_failed", (event) => {
      setResult(null);
      setText("");
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
        Math.max(contentHeight, status === "ready" ? 600 : 360),
        Math.max(500, window.screen.availHeight - 96),
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

    const interval = window.setInterval(() => {
      void getCurrentOcrStatus()
        .then((currentStatus) => {
          const hasNewResult =
            Boolean(currentStatus.result) &&
            currentStatus.result?.image_path !== activeImagePath;
          const hasNewProcessingImage =
            currentStatus.is_loading &&
            Boolean(currentStatus.image_path) &&
            currentStatus.image_path !== activeImagePath;

          if (status === "loading" || hasNewResult || hasNewProcessingImage || currentStatus.error) {
            applyOcrStatus(
              currentStatus,
              setResult,
              setText,
              setError,
              setStatus,
              setActiveImagePath,
            );
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => window.clearInterval(interval);
  }, [activeImagePath, status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void closeOcrReview();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSendToLookup() {
    if (!text.trim()) {
      setError("O texto reconhecido não pode ficar vazio.");
      return;
    }

    try {
      setIsSending(true);
      await closeOcrReview();
      await lookupText(text.trim());
    } finally {
      setIsSending(false);
    }
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <ErrorState message={userMessage(error ?? "Não foi possível reconhecer o texto.")} />
      </main>
    );
  }

  if (status === "loading" || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm rounded-md border bg-card p-5 text-card-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold">Reconhecendo texto</p>
              <p className="mt-1 text-sm text-muted-foreground">Processando área capturada...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <div className="border-b bg-card px-4 py-3 text-card-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">OCR</p>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <FileText className="size-5 text-primary" aria-hidden="true" />
              Texto reconhecido
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void closeOcrReview()} title="Fechar">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <textarea
          className="min-h-36 w-full resize-y rounded-md border bg-background p-3 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          aria-label="Texto reconhecido pelo OCR"
          autoFocus
        />

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {userMessage(error)}
          </p>
        ) : null}

        {result.warnings.length > 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            {userMessage(result.warnings[0])}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="truncate text-xs text-muted-foreground">{result.provider}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setText(result.text)}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Restaurar
            </Button>
            <Button onClick={handleSendToLookup} isLoading={isSending} disabled={!text.trim()}>
              <MessageSquareText className="size-4" aria-hidden="true" />
              Consultar
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function applyOcrStatus(
  currentStatus: {
    image_path?: string | null;
    result: OcrResult | null;
    error: string | null;
    is_loading: boolean;
  },
  setResult: (result: OcrResult | null) => void,
  setText: (text: string) => void,
  setError: (error: string | null) => void,
  setStatus: (status: "loading" | "ready" | "error") => void,
  setActiveImagePath: (imagePath: string | null) => void,
) {
  if (currentStatus.is_loading) {
    setResult(null);
    setText("");
    setError(null);
    setActiveImagePath(currentStatus.image_path ?? null);
    setStatus("loading");
    return;
  }

  if (currentStatus.result) {
    setResult(currentStatus.result);
    setText(currentStatus.result.text);
    setError(null);
    setActiveImagePath(currentStatus.result.image_path);
    setStatus("ready");
    return;
  }

  if (currentStatus.error) {
    setResult(null);
    setText("");
    setError(currentStatus.error);
    setActiveImagePath(currentStatus.image_path ?? null);
    setStatus("error");
    return;
  }
}
