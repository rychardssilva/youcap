import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { Moon, Sparkles, Sun } from "lucide-react";

import { navigationItems } from "@/app/navigation";
import { Toaster } from "@/components/shared/toaster";
import { Button } from "@/components/ui/button";
import { CapturePage } from "@/features/capture/capture-page";
import { NotesPage } from "@/features/notes/notes-page";
import { ReviewPage } from "@/features/review/review-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { VocabularyPage } from "@/features/vocabulary/vocabulary-page";
import { WordPage } from "@/features/word-page/word-page";
import { cn } from "@/lib/utils";
import { userMessage } from "@/lib/user-message";
import { useNavigationStore } from "@/stores/navigation-store";
import { defaultCaptureShortcut, useShortcutStore } from "@/stores/shortcut-store";
import { useThemeStore } from "@/stores/theme-store";
import { useToastStore } from "@/stores/toast-store";

const navigationGroups = [
  {
    label: "Principal",
    items: navigationItems.filter((item) => ["capture", "vocabulary", "word"].includes(item.id)),
  },
  {
    label: "Estudo",
    items: navigationItems.filter((item) => ["notes", "review"].includes(item.id)),
  },
  {
    label: "Sistema",
    items: navigationItems.filter((item) => item.id === "settings"),
  },
];

const sidebarWidthStorageKey = "yocab.sidebar-width";
const defaultSidebarWidth = 270;
const minSidebarWidth = 220;
const maxSidebarWidth = 360;

function renderView() {
  const currentView = useNavigationStore.getState().currentView;

  switch (currentView) {
    case "vocabulary":
      return <VocabularyPage />;
    case "capture":
      return <CapturePage />;
    case "word":
      return <WordPage />;
    case "notes":
      return <NotesPage />;
    case "review":
      return <ReviewPage />;
    case "settings":
      return <SettingsPage />;
  }
}

export function AppShell() {
  const { currentView, setCurrentView } = useNavigationStore();
  const setSelectedWordId = useNavigationStore((state) => state.setSelectedWordId);
  const { theme, toggleTheme } = useThemeStore();
  const addToast = useToastStore((state) => state.addToast);
  const shortcut = useShortcutStore((state) => state.shortcut);
  const loadShortcutStatus = useShortcutStore((state) => state.loadShortcutStatus);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedWidth = Number(window.localStorage.getItem(sidebarWidthStorageKey));

    return Number.isFinite(storedWidth) ? clampSidebarWidth(storedWidth) : defaultSidebarWidth;
  });

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    void loadShortcutStatus();
  }, [loadShortcutStatus]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const unlistenCaptureCompleted = listen<{ image_path: string; width: number; height: number }>(
      "capture_completed",
      (event) => {
        addToast({
          variant: "info",
          title: "Captura concluída",
          description: `${event.payload.width}x${event.payload.height}px capturado. OCR em andamento.`,
        });
      },
    );

    const unlistenCaptureCancelled = listen("capture_cancelled", () => {
      addToast({
        variant: "info",
        title: "Captura cancelada",
        description: "A seleção de área foi encerrada sem gerar imagem.",
      });
    });
    const unlistenCaptureFailed = listen<string>("capture_failed", (event) => {
      addToast({
        variant: "error",
        title: "Erro na captura",
        description: userMessage(event.payload),
      });
    });
    const unlistenOcrCompleted = listen<{ text: string }>("ocr_completed", (event) => {
      addToast({
        variant: "success",
        title: "Texto reconhecido",
        description: event.payload.text,
      });
    });
    const unlistenOcrFailed = listen<string>("ocr_failed", (event) => {
      addToast({
        variant: "error",
        title: "Erro no OCR",
        description: userMessage(event.payload),
      });
    });
    const unlistenLookupSaved = listen<{ term: string }>("lookup_saved", (event) => {
      addToast({
        variant: "success",
        title: "Palavra salva",
        description: `"${event.payload.term}" foi adicionada à biblioteca.`,
      });
    });
    const unlistenLookupDetails = listen<{ id: string; term: string }>(
      "lookup_details_requested",
      (event) => {
        setSelectedWordId(event.payload.id);
        setCurrentView("word");
        addToast({
          variant: "success",
          title: "Detalhes preparados",
          description: `"${event.payload.term}" foi salva e aberta na área de palavra.`,
        });
      },
    );

    return () => {
      void unlistenCaptureCompleted.then((unlisten) => unlisten());
      void unlistenCaptureCancelled.then((unlisten) => unlisten());
      void unlistenCaptureFailed.then((unlisten) => unlisten());
      void unlistenOcrCompleted.then((unlisten) => unlisten());
      void unlistenOcrFailed.then((unlisten) => unlisten());
      void unlistenLookupSaved.then((unlisten) => unlisten());
      void unlistenLookupDetails.then((unlisten) => unlisten());
    };
  }, [addToast, setCurrentView, setSelectedWordId]);

  function startSidebarResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;

    function resizeSidebar(pointerEvent: PointerEvent) {
      latestWidth = clampSidebarWidth(startWidth + pointerEvent.clientX - startX);
      setSidebarWidth(latestWidth);
    }

    function stopResize() {
      window.localStorage.setItem(sidebarWidthStorageKey, String(latestWidth));
      window.removeEventListener("pointermove", resizeSidebar);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", resizeSidebar);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <div
        className="grid min-h-screen"
        style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}
      >
        <aside className="relative flex min-h-screen flex-col border-r bg-sidebar text-sidebar-foreground">
          <div className="px-3 py-3">
            <div className="flex h-10 items-center gap-2 rounded-md px-2">
              <img
                className="size-7 rounded-md"
                src="/yocab-icon.png"
                alt=""
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5">Yocab</p>
                <p className="text-xs text-muted-foreground">Espaço de estudo</p>
              </div>
            </div>
          </div>

          <nav
            className="flex-1 space-y-5 overflow-auto px-3 py-3"
            aria-label="Navegação principal"
          >
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        currentView === item.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                      )}
                      type="button"
                      onClick={() => setCurrentView(item.id)}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3">
            <div className="rounded-md border bg-card/70 px-3 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <span>Atalho de captura</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-foreground">
                {shortcutParts(shortcut || defaultCaptureShortcut).map((part, index) => (
                  <span className="flex items-center gap-1" key={`${part}-${index}`}>
                    {index > 0 ? <span className="text-muted-foreground">+</span> : null}
                    <kbd className="rounded border bg-background px-1.5 py-0.5 text-[11px]">
                      {part}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="absolute right-[-4px] top-0 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ajustar largura do menu"
            title="Ajustar largura do menu"
            onPointerDown={startSidebarResize}
          />
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex h-11 items-center justify-end border-b bg-background/95 px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={toggleTheme}
                title="Alternar tema"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </header>

          <section className="flex-1 overflow-auto px-8 py-8">
            <div className="mx-auto w-full max-w-[1180px]">{renderView()}</div>
          </section>
        </main>
      </div>
    </div>
  );
}

function clampSidebarWidth(width: number) {
  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)));
}

function shortcutParts(shortcut: string) {
  return shortcut
    .replace(/CommandOrControl/gi, "Ctrl")
    .replace(/Control/gi, "Ctrl")
    .replace(/Command/gi, "Cmd")
    .replace(/Alt/gi, "Alt")
    .replace(/Shift/gi, "Shift")
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}
