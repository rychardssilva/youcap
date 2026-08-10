import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Moon, Search, Sparkles, Sun } from "lucide-react";

import { navigationItems } from "@/app/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Toaster } from "@/components/shared/toaster";
import { Button } from "@/components/ui/button";
import { CapturePage } from "@/features/capture/capture-page";
import { HistoryPage } from "@/features/history/history-page";
import { NotesPage } from "@/features/notes/notes-page";
import { ReviewPage } from "@/features/review/review-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { VocabularyPage } from "@/features/vocabulary/vocabulary-page";
import { WordPage } from "@/features/word-page/word-page";
import { cn } from "@/lib/utils";
import { userMessage } from "@/lib/user-message";
import { useNavigationStore } from "@/stores/navigation-store";
import { useThemeStore } from "@/stores/theme-store";
import { useToastStore } from "@/stores/toast-store";

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
    case "history":
      return <HistoryPage />;
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
  const activeItem = navigationItems.find((item) => item.id === currentView) ?? navigationItems[0];

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const unlistenCaptureCompleted = listen<{ image_path: string; width: number; height: number }>(
      "capture_completed",
      (event) => {
        addToast({
          variant: "info",
          title: "Captura concluida",
          description: `${event.payload.width}x${event.payload.height}px capturado. OCR em andamento.`,
        });
      },
    );

    const unlistenCaptureCancelled = listen("capture_cancelled", () => {
      addToast({
        variant: "info",
        title: "Captura cancelada",
        description: "A selecao de area foi encerrada sem gerar imagem.",
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
        description: `"${event.payload.term}" foi adicionada a biblioteca.`,
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
          description: `"${event.payload.term}" foi salva e aberta na area de palavra.`,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r bg-sidebar text-sidebar-foreground">
          <div className="border-b px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5">Immersion Vocabulary</p>
                <p className="text-xs text-muted-foreground">MVP Windows</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegacao principal">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  currentView === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                type="button"
                onClick={() => setCurrentView(item.id)}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="border-t p-3">
            <div className="rounded-md bg-muted px-3 py-3 text-xs text-muted-foreground">
              Atalho planejado
              <div className="mt-2 flex items-center gap-2 text-foreground">
                <kbd className="rounded border bg-background px-1.5 py-0.5 text-[11px]">Ctrl</kbd>
                <kbd className="rounded border bg-background px-1.5 py-0.5 text-[11px]">Shift</kbd>
                <kbd className="rounded border bg-background px-1.5 py-0.5 text-[11px]">E</kbd>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b px-6">
            <PageHeader title={activeItem.label} description={activeItem.description} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" title="Pesquisar">
                <Search className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" onClick={toggleTheme} title="Alternar tema">
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </header>

          <section className="flex-1 overflow-auto p-6">{renderView()}</section>
        </main>
      </div>
    </div>
  );
}
