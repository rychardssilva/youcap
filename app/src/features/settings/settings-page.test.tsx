import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/settings-page";
import { defaultCaptureShortcut, useShortcutStore } from "@/stores/shortcut-store";
import { useThemeStore } from "@/stores/theme-store";

const mockListSettings = vi.fn();
const mockUpsertSetting = vi.fn();
const mockGetCaptureShortcutStatus = vi.fn();
const mockRegisterCaptureShortcut = vi.fn();
const mockUnregisterCaptureShortcut = vi.fn();
const mockGetDatabaseHealth = vi.fn();

vi.mock("@/services/settings-service", () => ({
  listSettings: (...args: unknown[]) => mockListSettings(...args),
  upsertSetting: (...args: unknown[]) => mockUpsertSetting(...args),
}));

vi.mock("@/services/capture-service", () => ({
  getCaptureShortcutStatus: (...args: unknown[]) => mockGetCaptureShortcutStatus(...args),
  registerCaptureShortcut: (...args: unknown[]) => mockRegisterCaptureShortcut(...args),
  unregisterCaptureShortcut: (...args: unknown[]) => mockUnregisterCaptureShortcut(...args),
}));

vi.mock("@/services/database-service", () => ({
  getDatabaseHealth: (...args: unknown[]) => mockGetDatabaseHealth(...args),
  createWord: vi.fn(),
}));

describe("Configurações do aplicativo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useThemeStore.setState({ theme: "light" });
    useShortcutStore.setState({
      shortcut: defaultCaptureShortcut,
      registered: false,
      isLoading: false,
    });

    mockListSettings.mockResolvedValue([
      { key: "theme", value: "dark", updated_at: "2026-08-04T10:00:00Z" },
      { key: "target_language", value: "pt-BR", updated_at: "2026-08-04T10:00:00Z" },
      { key: "ocr_space_api_key", value: "ocr-key", updated_at: "2026-08-04T10:00:00Z" },
      { key: "gemini_api_key", value: "gemini-key", updated_at: "2026-08-04T10:00:00Z" },
      { key: "pexels_api_key", value: "pexels-key", updated_at: "2026-08-04T10:00:00Z" },
    ]);
    mockGetCaptureShortcutStatus.mockResolvedValue({
      shortcut: "CommandOrControl+Shift+E",
      registered: true,
    });
    mockRegisterCaptureShortcut.mockResolvedValue({
      shortcut: "CommandOrControl+Alt+E",
      registered: true,
    });
    mockUnregisterCaptureShortcut.mockResolvedValue({
      shortcut: "CommandOrControl+Shift+E",
      registered: false,
    });
    mockUpsertSetting.mockResolvedValue({
      key: "theme",
      value: "dark",
      updated_at: "2026-08-04T10:00:00Z",
    });
  });

  it("carrega Preferências e salva atalho, idioma, tema e providers", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByRole("button", { name: "Atalho global" })).toHaveTextContent(
      "CTRL+SHIFT+E",
    );
    expect(screen.getByDisplayValue("ocr-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gemini-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pexels-key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claro" })).toHaveClass("bg-primary");

    await user.click(screen.getByRole("button", { name: "Editar atalho" }));
    await user.keyboard("{Control>}{Alt>}e{/Alt}{/Control}");
    await user.click(screen.getByRole("button", { name: "Salvar atalho" }));

    await waitFor(() =>
      expect(mockRegisterCaptureShortcut).toHaveBeenCalledWith("CommandOrControl+Alt+E"),
    );

    await user.click(screen.getByRole("button", { name: /Salvar Preferências/i }));

    expect(mockUpsertSetting).toHaveBeenCalledWith("theme", "light");
    expect(mockUpsertSetting).toHaveBeenCalledWith("global_shortcut", "CommandOrControl+Alt+E");
    expect(mockUpsertSetting).toHaveBeenCalledWith("target_language", "pt-BR");

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockUpsertSetting).toHaveBeenCalledWith("ocr_provider", "ocr_space"),
    );
    expect(mockUpsertSetting).toHaveBeenCalledWith("ai_provider", "gemini");
    expect(mockUpsertSetting).toHaveBeenCalledWith("ocr_space_api_key", "ocr-key");
    expect(mockUpsertSetting).toHaveBeenCalledWith("gemini_api_key", "gemini-key");
    expect(mockUpsertSetting).toHaveBeenCalledWith("pexels_api_key", "pexels-key");
  });
});
