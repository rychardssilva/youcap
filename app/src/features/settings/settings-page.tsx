import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from "react";
import {
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Keyboard,
  Languages,
  MessageSquareText,
  Monitor,
  Save,
  ServerCog,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import { lookupText } from "@/services/lookup-service";
import { listSettings, upsertSetting } from "@/services/settings-service";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { defaultCaptureShortcut, useShortcutStore } from "@/stores/shortcut-store";
import { useThemeStore } from "@/stores/theme-store";
import { useToastStore } from "@/stores/toast-store";

const providerSettings = [
  { key: "system", label: "Sistema inicial", value: "Windows", icon: Monitor },
  { key: "ocr_provider", label: "OCR", value: "OCR.space API", icon: ServerCog },
  { key: "ai_provider", label: "Tradução e IA", value: "Gemini API", icon: ServerCog },
  { key: "image_provider", label: "Imagens", value: "Pexels + Wikipedia", icon: ServerCog },
];

const apiGuideUrl =
  "https://docs.google.com/document/d/1Y5fqx_ABCPKW2rb1c6CsdQSU46AQFO3_DoMqLuIfjDw/edit?usp=sharing";

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const addToast = useToastStore((state) => state.addToast);
  const openOnboarding = useOnboardingStore((state) => state.openOnboarding);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingProviders, setIsSavingProviders] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showProviderKeys, setShowProviderKeys] = useState(false);
  const [runInBackground, setRunInBackground] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [ocrSpaceApiKey, setOcrSpaceApiKey] = useState("");
  const [pexelsApiKey, setPexelsApiKey] = useState("");
  const [lookupInput, setLookupInput] = useState("I ran out of time");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const shortcut = useShortcutStore((state) => state.shortcut);
  const shortcutRegistered = useShortcutStore((state) => state.registered);
  const shortcutIsLoading = useShortcutStore((state) => state.isLoading);
  const loadShortcutStatus = useShortcutStore((state) => state.loadShortcutStatus);
  const registerShortcut = useShortcutStore((state) => state.registerShortcut);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [draftShortcut, setDraftShortcut] = useState(defaultCaptureShortcut);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [settings] = await Promise.all([listSettings(), loadShortcutStatus()]);

        if (!isMounted) {
          return;
        }

        setGeminiApiKey(settings.find((setting) => setting.key === "gemini_api_key")?.value ?? "");
        setOcrSpaceApiKey(
          settings.find((setting) => setting.key === "ocr_space_api_key")?.value ?? "",
        );
        setPexelsApiKey(settings.find((setting) => setting.key === "pexels_api_key")?.value ?? "");
        setRunInBackground(
          settings.find((setting) => setting.key === "run_in_background")?.value === "true",
        );
      } catch (err) {
        addToast({
          variant: "error",
          title: "Erro ao carregar configurações",
          description: userMessage(errorMessage(err)),
        });
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [addToast, loadShortcutStatus]);

  async function updateThemePreference(nextTheme: "light" | "dark") {
    setTheme(nextTheme);

    try {
      await upsertSetting("theme", nextTheme);
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao salvar tema",
        description: userMessage(errorMessage(err)),
      });
    }
  }

  async function updateRunInBackgroundPreference(nextValue: boolean) {
    setRunInBackground(nextValue);

    try {
      await upsertSetting("run_in_background", String(nextValue));
      addToast({
        variant: "success",
        title: nextValue ? "Segundo plano ativado" : "Segundo plano desativado",
        description: nextValue
          ? "Ao fechar a janela principal, o Yocab continuará no ícone da bandeja."
          : "Ao fechar a janela principal, o Yocab será encerrado.",
      });
    } catch (err) {
      setRunInBackground(!nextValue);
      addToast({
        variant: "error",
        title: "Erro ao salvar segundo plano",
        description: userMessage(errorMessage(err)),
      });
    }
  }

  function handleShortcutKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!isEditingShortcut) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setIsEditingShortcut(false);
      return;
    }

    const nextShortcut = shortcutFromKeyboardEvent(event);
    if (!nextShortcut) {
      return;
    }

    setDraftShortcut(nextShortcut);
  }

  function openShortcutDialog() {
    setDraftShortcut(shortcut);
    setIsEditingShortcut(true);
  }

  async function confirmShortcutEdit() {
    try {
      await registerShortcut(draftShortcut);
      setIsEditingShortcut(false);
      addToast({
        variant: "success",
        title: "Atalho atualizado",
        description: "O novo atalho foi registrado e já vale para a captura.",
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao registrar atalho",
        description: userMessage(errorMessage(err)),
      });
    }
  }

  async function saveProviderSettings() {
    try {
      setIsSavingProviders(true);
      await upsertSetting("ocr_provider", "ocr_space");
      await upsertSetting("ai_provider", "gemini");
      await upsertSetting("ocr_space_api_key", ocrSpaceApiKey.trim());
      await upsertSetting("gemini_api_key", geminiApiKey.trim());
      await upsertSetting("pexels_api_key", pexelsApiKey.trim());
      addToast({
        variant: "success",
        title: "Providers salvos",
        description: "As configurações de OCR, IA e imagens foram persistidas no SQLite local.",
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao salvar providers",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsSavingProviders(false);
    }
  }

  async function openApiGuide() {
    try {
      if ("__TAURI_INTERNALS__" in window) {
        await openUrl(apiGuideUrl);
      } else {
        window.open(apiGuideUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      addToast({
        variant: "error",
        title: "Não foi possível abrir o guia",
        description: userMessage(errorMessage(err)),
      });
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
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro na consulta",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <section className="surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Preferências essenciais</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tema, idioma e atalho usados no fluxo principal.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="surface-soft p-4">
            <div className="flex items-center gap-2">
              <Monitor className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-medium">Tema</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => void updateThemePreference("light")}
              >
                Claro
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => void updateThemePreference("dark")}
              >
                Escuro
              </Button>
            </div>
          </div>

          <div className="surface-soft p-4">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-medium">Idioma de destino</h3>
            </div>
            <div
              className="mt-4 flex h-11 items-center rounded-md border border-input bg-background px-3 text-sm font-medium"
              aria-label="Idioma de destino"
            >
              Português (Brasil)
            </div>
          </div>

          <div className="surface-soft p-4">
            <div className="flex items-center gap-2">
              <Keyboard className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-medium">Atalho do teclado</h3>
            </div>
            <div className="mt-4 flex h-11 min-w-0 items-center rounded-md border border-input bg-background">
              <button
                className="flex h-full min-w-0 flex-1 items-center overflow-hidden px-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={openShortcutDialog}
                aria-label="Atalho global"
                title={formatShortcut(shortcut)}
              >
                <ShortcutKeys shortcut={shortcut} />
              </button>
              <Button
                className="mr-1 h-8 shrink-0 bg-muted px-2 hover:bg-accent"
                variant="outline"
                type="button"
                onClick={openShortcutDialog}
                title="Editar atalho"
                aria-label="Editar atalho"
              >
                <Edit3 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-foreground">
                {isLoadingSettings || shortcutIsLoading
                  ? "carregando"
                  : shortcutRegistered
                    ? "ativo"
                    : "não registrado"}
              </span>
            </p>
          </div>
        </div>

        <div className="surface-soft mt-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <Monitor className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-medium">Rodar em segundo plano</h3>
            </div>
          </div>
          <Button
            type="button"
            variant={runInBackground ? "default" : "outline"}
            onClick={() => void updateRunInBackgroundPreference(!runInBackground)}
            aria-pressed={runInBackground}
          >
            {runInBackground ? "Ativado" : "Ativar"}
          </Button>
        </div>
      </section>

      {isEditingShortcut ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
          <div
            className="surface w-full max-w-md p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-dialog-title"
            onKeyDown={handleShortcutKeyDown}
          >
            <div>
              <h2 id="shortcut-dialog-title" className="font-medium">
                Editar atalho
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pressione a nova combinação de teclas que iniciará a captura.
              </p>
            </div>

            <button
              className="mt-5 flex min-h-16 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              autoFocus
              onKeyDown={handleShortcutKeyDown}
            >
              <ShortcutKeys shortcut={draftShortcut} size="large" />
            </button>

            <p className="mt-3 text-xs text-muted-foreground">
              Use pelo menos um modificador, como Ctrl, Shift ou Alt.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setIsEditingShortcut(false)}>
                Cancelar
              </Button>
              <Button type="button" isLoading={shortcutIsLoading} onClick={confirmShortcutEdit}>
                Salvar atalho
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-medium">Tutorial do Yocab</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reveja o passo a passo inicial de captura, popup, Biblioteca e Caderno.
              </p>
            </div>
          </div>
          <Button variant="outline" type="button" onClick={openOnboarding}>
            Ver tutorial
          </Button>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Providers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              OCR, IA e imagens usam chaves pessoais salvas apenas neste computador.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
              Ao usar captura, tradução ou imagens, o Yocab pode enviar a imagem capturada, o texto
              reconhecido ou termos de busca para OCR.space, Gemini, Pexels e Wikipedia.
            </p>
          </div>
          <Button
            variant="outline"
            type="button"
            onClick={() => setShowAdvancedSettings((isVisible) => !isVisible)}
            aria-expanded={showAdvancedSettings}
          >
            Configurações avançadas
          </Button>
        </div>

        {showAdvancedSettings ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3">
              {providerSettings.map((item) => (
                <div
                  key={item.key}
                  className="surface-soft flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="size-5 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="surface-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <KeyRound className="size-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Chaves gratuitas dos providers</p>
                    <p className="text-sm text-muted-foreground">
                      Também podem ser definidas por OCR_SPACE_API_KEY, GEMINI_API_KEY e
                      PEXELS_API_KEY.
                    </p>
                  </div>
                </div>
                <Button variant="outline" type="button" onClick={() => void openApiGuide()}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Guia das chaves
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowProviderKeys((isVisible) => !isVisible)}
                  aria-pressed={showProviderKeys}
                >
                  {showProviderKeys ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                  {showProviderKeys ? "Ocultar chaves" : "Mostrar chaves"}
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_140px]">
                <input
                  className="field w-full"
                  type={showProviderKeys ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={ocrSpaceApiKey}
                  onChange={(event) => setOcrSpaceApiKey(event.currentTarget.value)}
                  placeholder="Chave do OCR.space"
                  aria-label="Chave da API OCR.space"
                />
                <div className="hidden xl:block" />
                <input
                  className="field w-full"
                  type={showProviderKeys ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.currentTarget.value)}
                  placeholder="Chave do Gemini"
                  aria-label="Chave da API Gemini"
                />
                <div className="hidden xl:block" />
                <input
                  className="field w-full"
                  type={showProviderKeys ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={pexelsApiKey}
                  onChange={(event) => setPexelsApiKey(event.currentTarget.value)}
                  placeholder="Chave do Pexels"
                  aria-label="Chave da API Pexels"
                />
                <Button isLoading={isSavingProviders} onClick={saveProviderSettings}>
                  <Save className="size-4" aria-hidden="true" />
                  Salvar
                </Button>
              </div>
            </div>

            <div className="surface-soft p-4">
              <div className="flex items-center gap-3">
                <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Teste de consulta contextual</p>
                  <p className="text-sm text-muted-foreground">
                    Entrada temporária para validar tradução e IA sem passar pela captura.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_140px]">
                <input
                  className="field w-full"
                  value={lookupInput}
                  onChange={(event) => setLookupInput(event.currentTarget.value)}
                  aria-label="Texto para teste de consulta contextual"
                />
                <Button type="button" isLoading={isLookingUp} onClick={handleLookupText}>
                  <MessageSquareText className="size-4" aria-hidden="true" />
                  Consultar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ShortcutKeys({
  shortcut,
  size = "compact",
}: {
  shortcut: string;
  size?: "compact" | "large";
}) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
      {shortcutParts(shortcut).map((part, index) => (
        <span className="flex items-center gap-1" key={`${part}-${index}`}>
          {index > 0 ? <span className="text-xs text-muted-foreground">+</span> : null}
          <kbd
            className={
              size === "large"
                ? "rounded border border-border bg-muted px-3 py-1.5 text-sm font-semibold text-foreground"
                : "rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-foreground"
            }
          >
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function shortcutFromKeyboardEvent(event: ReactKeyboardEvent<HTMLElement>) {
  const key = normalizedShortcutKey(event.key);
  if (!key) {
    return null;
  }

  const parts = [
    event.ctrlKey || event.metaKey ? "CommandOrControl" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    key,
  ].filter(Boolean);

  if (parts.length < 2 || isModifierKey(key)) {
    return null;
  }

  return parts.join("+");
}

function normalizedShortcutKey(key: string) {
  if (key.length === 1) {
    return key.toUpperCase();
  }

  const aliases: Record<string, string> = {
    " ": "Space",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Backspace: "Backspace",
    Delete: "Delete",
    Enter: "Enter",
    Escape: "Escape",
    Tab: "Tab",
  };

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }

  return aliases[key] ?? null;
}

function isModifierKey(key: string) {
  return ["Control", "Shift", "Alt", "Meta", "CommandOrControl"].includes(key);
}

function formatShortcut(shortcut: string) {
  return shortcutParts(shortcut).join(" + ");
}

function shortcutParts(shortcut: string) {
  return shortcut
    .replace(/CommandOrControl/gi, "CTRL")
    .replace(/Control/gi, "CTRL")
    .replace(/Command/gi, "CMD")
    .replace(/Alt/gi, "ALT")
    .replace(/Shift/gi, "SHIFT")
    .split("+")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}
