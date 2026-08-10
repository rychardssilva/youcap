import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/settings-page";
import { useThemeStore } from "@/stores/theme-store";

const mockListSettings = vi.fn();
const mockUpsertSetting = vi.fn();
const mockGetCaptureShortcutStatus = vi.fn();
const mockRegisterCaptureShortcut = vi.fn();
const mockGetDatabaseHealth = vi.fn();

vi.mock("@/services/settings-service", () => ({
  listSettings: (...args: unknown[]) => mockListSettings(...args),
  upsertSetting: (...args: unknown[]) => mockUpsertSetting(...args),
}));

vi.mock("@/services/capture-service", () => ({
  getCaptureShortcutStatus: (...args: unknown[]) => mockGetCaptureShortcutStatus(...args),
  registerCaptureShortcut: (...args: unknown[]) => mockRegisterCaptureShortcut(...args),
}));

vi.mock("@/services/database-service", () => ({
  getDatabaseHealth: (...args: unknown[]) => mockGetDatabaseHealth(...args),
  createWord: vi.fn(),
}));

describe("Configuracoes do MVP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useThemeStore.setState({ theme: "light" });

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
    mockUpsertSetting.mockResolvedValue({
      key: "theme",
      value: "dark",
      updated_at: "2026-08-04T10:00:00Z",
    });
  });

  it("carrega preferencias e salva atalho, idioma, tema e providers", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("CommandOrControl+Shift+E")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ocr-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gemini-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pexels-key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escuro" })).toHaveClass("bg-primary");

    await user.clear(screen.getByLabelText("Atalho global"));
    await user.type(screen.getByLabelText("Atalho global"), "CommandOrControl+Alt+E");
    await user.click(screen.getByRole("button", { name: /Salvar preferencias/i }));

    await waitFor(() =>
      expect(mockRegisterCaptureShortcut).toHaveBeenCalledWith("CommandOrControl+Alt+E"),
    );
    expect(mockUpsertSetting).toHaveBeenCalledWith("theme", "dark");
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
