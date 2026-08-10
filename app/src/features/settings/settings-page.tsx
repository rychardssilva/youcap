import { useEffect, useState } from "react";
import {
  Database,
  KeyRound,
  Keyboard,
  Languages,
  Monitor,
  Plus,
  Save,
  ServerCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import {
  getCaptureShortcutStatus,
  registerCaptureShortcut,
  type CaptureShortcutStatus,
} from "@/services/capture-service";
import {
  createWord,
  getDatabaseHealth,
  type DatabaseHealth,
  type Word,
} from "@/services/database-service";
import { listSettings, upsertSetting } from "@/services/settings-service";
import { useThemeStore } from "@/stores/theme-store";
import { useToastStore } from "@/stores/toast-store";

const defaultShortcut = "CommandOrControl+Shift+E";
const defaultTargetLanguage = "pt-BR";

const targetLanguages = [{ label: "Portugues (Brasil)", value: "pt-BR" }];

const providerSettings = [
  { key: "system", label: "Sistema inicial", value: "Windows", icon: Monitor },
  { key: "ocr_provider", label: "OCR", value: "OCR.space API", icon: ServerCog },
  { key: "ai_provider", label: "Traducao e IA", value: "Gemini API", icon: ServerCog },
  { key: "image_provider", label: "Imagens", value: "Pexels + Wikipedia", icon: ServerCog },
];

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const addToast = useToastStore((state) => state.addToast);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSavingProviders, setIsSavingProviders] = useState(false);
  const [isCheckingDatabase, setIsCheckingDatabase] = useState(false);
  const [isCreatingWord, setIsCreatingWord] = useState(false);
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null);
  const [lastWord, setLastWord] = useState<Word | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [ocrSpaceApiKey, setOcrSpaceApiKey] = useState("");
  const [pexelsApiKey, setPexelsApiKey] = useState("");
  const [shortcut, setShortcut] = useState(defaultShortcut);
  const [shortcutStatus, setShortcutStatus] = useState<CaptureShortcutStatus | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(defaultTargetLanguage);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [settings, status] = await Promise.all([listSettings(), getCaptureShortcutStatus()]);

        if (!isMounted) {
          return;
        }

        setShortcutStatus(status);
        setShortcut(status.shortcut || defaultShortcut);

        const storedTheme = settings.find((setting) => setting.key === "theme")?.value;
        if (storedTheme === "light" || storedTheme === "dark") {
          setTheme(storedTheme);
        }

        setTargetLanguage(
          settings.find((setting) => setting.key === "target_language")?.value ??
            defaultTargetLanguage,
        );
        setGeminiApiKey(settings.find((setting) => setting.key === "gemini_api_key")?.value ?? "");
        setOcrSpaceApiKey(
          settings.find((setting) => setting.key === "ocr_space_api_key")?.value ?? "",
        );
        setPexelsApiKey(settings.find((setting) => setting.key === "pexels_api_key")?.value ?? "");
      } catch (err) {
        addToast({
          variant: "error",
          title: "Erro ao carregar configuracoes",
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
  }, [addToast, setTheme]);

  async function savePreferences() {
    try {
      setIsSavingPreferences(true);

      const registeredShortcut = await registerCaptureShortcut(shortcut);
      await upsertSetting("theme", theme);
      await upsertSetting("global_shortcut", registeredShortcut.shortcut);
      await upsertSetting("target_language", targetLanguage);

      setShortcut(registeredShortcut.shortcut);
      setShortcutStatus(registeredShortcut);

      addToast({
        variant: "success",
        title: "Preferencias salvas",
        description: "Tema, idioma e atalho foram aplicados e persistidos.",
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao salvar preferencias",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function checkDatabase() {
    try {
      setIsCheckingDatabase(true);
      const health = await getDatabaseHealth();
      setDatabaseHealth(health);
      addToast({
        variant: "success",
        title: "Banco local pronto",
        description: `Palavras: ${health.words_count} | Configuracoes: ${health.settings_count}`,
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro no banco local",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsCheckingDatabase(false);
    }
  }

  async function createTestWord() {
    try {
      setIsCreatingWord(true);
      const word = await createWord("context");
      const health = await getDatabaseHealth();
      setLastWord(word);
      setDatabaseHealth(health);
      addToast({
        variant: "success",
        title: "Palavra de teste salva",
        description: `"${word.term}" foi persistida no SQLite.`,
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao salvar palavra",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsCreatingWord(false);
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
        description: "As configuracoes de OCR, IA e imagens foram persistidas no SQLite local.",
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

  return (
    <div className="max-w-4xl space-y-5">
      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Preferencias essenciais</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tema, idioma e atalho usados no fluxo principal do MVP.
            </p>
          </div>
          <Button isLoading={isSavingPreferences} onClick={savePreferences}>
            <Save className="size-4" aria-hidden="true" />
            {isSavingPreferences ? "Salvando" : "Salvar preferencias"}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Monitor className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Tema</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
              >
                Claro
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
              >
                Escuro
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Idioma de destino</h3>
            </div>
            <select
              className="mt-4 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.currentTarget.value)}
              aria-label="Idioma de destino"
            >
              {targetLanguages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Keyboard className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Atalho global</h3>
            </div>
            <input
              className="mt-4 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={shortcut}
              onChange={(event) => setShortcut(event.currentTarget.value)}
              aria-label="Atalho global"
              placeholder={defaultShortcut}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-foreground">
                {isLoadingSettings
                  ? "carregando"
                  : shortcutStatus?.registered
                    ? "ativo"
                    : "nao registrado"}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <h2 className="font-semibold">Providers do MVP</h2>
        <div className="mt-4 grid gap-3">
          {providerSettings.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-md border p-4"
            >
              <div className="flex items-center gap-3">
                <item.icon className="size-5 text-primary" aria-hidden="true" />
                <p className="text-sm font-medium">{item.label}</p>
              </div>
              <p className="text-sm text-muted-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md border p-4">
          <div className="flex items-center gap-3">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Chaves gratuitas dos providers</p>
              <p className="text-sm text-muted-foreground">
                Tambem podem ser definidas por OCR_SPACE_API_KEY, GEMINI_API_KEY e PEXELS_API_KEY.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_140px]">
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={ocrSpaceApiKey}
              onChange={(event) => setOcrSpaceApiKey(event.currentTarget.value)}
              placeholder="Chave do OCR.space"
              aria-label="Chave da API OCR.space"
            />
            <div className="hidden xl:block" />
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.currentTarget.value)}
              placeholder="Chave do Gemini"
              aria-label="Chave da API Gemini"
            />
            <div className="hidden xl:block" />
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
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
      </section>

      <section className="rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Banco local</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" isLoading={isCheckingDatabase} onClick={checkDatabase}>
              Validar banco
            </Button>
            <Button isLoading={isCreatingWord} onClick={createTestWord}>
              <Plus className="size-4" aria-hidden="true" />
              Criar palavra teste
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">
              {databaseHealth?.status ?? "Aguardando validacao"}
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Palavras</p>
            <p className="mt-1 text-sm font-medium">{databaseHealth?.words_count ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Consultas</p>
            <p className="mt-1 text-sm font-medium">{databaseHealth?.lookups_count ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Configuracoes</p>
            <p className="mt-1 text-sm font-medium">{databaseHealth?.settings_count ?? 0}</p>
          </div>
        </div>

        {lastWord ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ultima palavra criada:{" "}
            <span className="font-medium text-foreground">{lastWord.term}</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
