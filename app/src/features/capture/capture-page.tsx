import { useEffect, useState } from "react";
import { Crosshair, Keyboard, Loader2, MonitorUp, Power, PowerOff } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { openCaptureOverlay } from "@/services/capture-service";
import { defaultCaptureShortcut, useShortcutStore } from "@/stores/shortcut-store";
import { useToastStore } from "@/stores/toast-store";

export function CapturePage() {
  const addToast = useToastStore((state) => state.addToast);
  const shortcut = useShortcutStore((state) => state.shortcut);
  const shortcutRegistered = useShortcutStore((state) => state.registered);
  const shortcutIsLoading = useShortcutStore((state) => state.isLoading);
  const loadShortcutStatus = useShortcutStore((state) => state.loadShortcutStatus);
  const registerShortcut = useShortcutStore((state) => state.registerShortcut);
  const unregisterShortcut = useShortcutStore((state) => state.unregisterShortcut);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void loadShortcutStatus();
  }, [loadShortcutStatus]);

  async function handleRegisterShortcut() {
    try {
      const nextStatus = await registerShortcut(shortcut || defaultCaptureShortcut);
      addToast({
        variant: "success",
        title: "Atalho registrado",
        description: `${nextStatus.shortcut} está pronto para iniciar captura.`,
      });
    } catch {
      addToast({
        variant: "error",
        title: "Conflito de atalho",
        description: "Não foi possível registrar esse atalho global.",
      });
    }
  }

  async function handleUnregisterShortcut() {
    try {
      await unregisterShortcut();
      addToast({
        variant: "info",
        title: "Atalho removido",
        description: "A captura por atalho global foi desativada.",
      });
    } catch {
      addToast({
        variant: "error",
        title: "Erro ao remover atalho",
        description: "Não foi possível desativar esse atalho global.",
      });
    }
  }

  async function handleOpenCapture() {
    try {
      setIsOpening(true);
      await openCaptureOverlay();
    } catch {
      addToast({
        variant: "error",
        title: "Erro ao abrir captura",
        description: "Não foi possível criar a janela de seleção.",
      });
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-muted">
              <Keyboard className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-medium">Atalho global</h2>
              <p className="text-sm text-muted-foreground">
                Funciona com o aplicativo aberto ou em segundo plano.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              isLoading={shortcutIsLoading && !shortcutRegistered}
              onClick={handleUnregisterShortcut}
              disabled={!shortcutRegistered}
            >
              <PowerOff className="size-4" aria-hidden="true" />
              Remover
            </Button>
            <Button
              type="button"
              isLoading={shortcutIsLoading && shortcutRegistered}
              onClick={handleRegisterShortcut}
            >
              <Power className="size-4" aria-hidden="true" />
              Registrar
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
          <div className="surface-soft flex min-h-11 items-center px-3 text-sm font-medium">
            {formatShortcut(shortcut || defaultCaptureShortcut)}
          </div>
          <div className="surface-soft px-3 py-2 text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">{shortcutRegistered ? "ativo" : "inativo"}</span>
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-muted">
              <Crosshair className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-medium">Seleção de área</h2>
              <p className="text-sm text-muted-foreground">
                Abre uma sobreposição fullscreen para selecionar a região da tela.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            onClick={handleOpenCapture}
            disabled={isOpening}
          >
            {isOpening ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MonitorUp className="size-4" aria-hidden="true" />
            )}
            Iniciar captura
          </button>
        </div>
      </section>

      <EmptyState
        icon={Crosshair}
        title="Fluxo de captura preparado"
        description="Use o botão de captura ou o atalho global. Arraste para selecionar uma área; pressione Esc para cancelar."
      />
    </div>
  );
}

function formatShortcut(shortcut: string) {
  return shortcut
    .replace(/CommandOrControl/gi, "Ctrl")
    .replace(/Control/gi, "Ctrl")
    .replace(/Command/gi, "Cmd")
    .replace(/Alt/gi, "Alt")
    .replace(/Shift/gi, "Shift")
    .replace(/\+/g, " + ");
}
