import { useEffect, useState } from "react";
import {
  Crosshair,
  Keyboard,
  Languages,
  Loader2,
  MessageSquareText,
  MonitorUp,
  Power,
  PowerOff,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  openCaptureOverlay,
  getCaptureShortcutStatus,
  registerCaptureShortcut,
  unregisterCaptureShortcut,
  type CaptureShortcutStatus,
} from "@/services/capture-service";
import { lookupText } from "@/services/lookup-service";
import { upsertSetting } from "@/services/settings-service";
import { useToastStore } from "@/stores/toast-store";

const defaultShortcut = "CommandOrControl+Shift+E";

export function CapturePage() {
  const addToast = useToastStore((state) => state.addToast);
  const [shortcut, setShortcut] = useState(defaultShortcut);
  const [status, setStatus] = useState<CaptureShortcutStatus>({
    shortcut: defaultShortcut,
    registered: true,
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [lookupInput, setLookupInput] = useState("I ran out of time");
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    void getCaptureShortcutStatus().then((nextStatus) => {
      setStatus(nextStatus);
      setShortcut(nextStatus.shortcut);
    });
  }, []);

  async function handleRegisterShortcut() {
    try {
      setIsRegistering(true);
      const nextStatus = await registerCaptureShortcut(shortcut);
      await upsertSetting("global_shortcut", nextStatus.shortcut);
      setStatus(nextStatus);
      addToast({
        variant: "success",
        title: "Atalho registrado",
        description: `${nextStatus.shortcut} esta pronto para iniciar captura.`,
      });
    } catch {
      addToast({
        variant: "error",
        title: "Conflito de atalho",
        description: "Nao foi possivel registrar esse atalho global.",
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleUnregisterShortcut() {
    try {
      setIsRegistering(true);
      const nextStatus = await unregisterCaptureShortcut();
      setStatus(nextStatus);
      addToast({
        variant: "info",
        title: "Atalho removido",
        description: "A captura por atalho global foi desativada.",
      });
    } finally {
      setIsRegistering(false);
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
        description: "Nao foi possivel criar a janela de selecao.",
      });
    } finally {
      setIsOpening(false);
    }
  }

  async function handleLookupText() {
    try {
      setIsLookingUp(true);
      await lookupText(lookupInput);
      addToast({
        variant: "success",
        title: "Consulta criada",
        description: "O popup contextual foi aberto com o resultado.",
      });
    } catch {
      addToast({
        variant: "error",
        title: "Erro na consulta",
        description: "Nao foi possivel consultar esse texto agora.",
      });
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Keyboard className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Atalho global</h2>
              <p className="text-sm text-muted-foreground">
                Funciona com o aplicativo aberto ou em segundo plano.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              isLoading={isRegistering && !status.registered}
              onClick={handleUnregisterShortcut}
              disabled={!status.registered}
            >
              <PowerOff className="size-4" aria-hidden="true" />
              Remover
            </Button>
            <Button
              type="button"
              isLoading={isRegistering && status.registered}
              onClick={handleRegisterShortcut}
            >
              <Power className="size-4" aria-hidden="true" />
              Registrar
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            value={shortcut}
            onChange={(event) => setShortcut(event.currentTarget.value)}
            aria-label="Atalho global"
          />
          <div className="rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">{status.registered ? "ativo" : "inativo"}</span>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Crosshair className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Selecao de area</h2>
              <p className="text-sm text-muted-foreground">
                Abre uma sobreposicao fullscreen para selecionar a regiao da tela.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
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

      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <Languages className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold">Consulta contextual</h2>
            <p className="text-sm text-muted-foreground">
              Entrada temporaria para testar o provider de IA antes da etapa de OCR.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_160px]">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            value={lookupInput}
            onChange={(event) => setLookupInput(event.currentTarget.value)}
            aria-label="Texto para consulta contextual"
          />
          <Button type="button" isLoading={isLookingUp} onClick={handleLookupText}>
            <MessageSquareText className="size-4" aria-hidden="true" />
            Consultar
          </Button>
        </div>
      </section>

      <EmptyState
        icon={Crosshair}
        title="Fluxo de captura preparado"
        description="Use o botao de captura ou o atalho global. Arraste para selecionar uma area; pressione Esc para cancelar."
      />
    </div>
  );
}
