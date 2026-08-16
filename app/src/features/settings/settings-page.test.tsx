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

vi.mock("@/services/settings-service", () => ({
  listSettings: (...args: unknown[]) => mockListSettings(...args),
  upsertSetting: (...args: unknown[]) => mockUpsertSetting(...args),
}));

vi.mock("@/services/capture-service", () => ({
  getCaptureShortcutStatus: (...args: unknown[]) => mockGetCaptureShortcutStatus(...args),
  registerCaptureShortcut: (...args: unknown[]) => mockRegisterCaptureShortcut(...args),
  unregisterCaptureShortcut: (...args: unknown[]) => mockUnregisterCaptureShortcut(...args),
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
      { key: "run_in_background", value: "false", updated_at: "2026-08-04T10:00:00Z" },
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
    expect(screen.getByLabelText("Idioma de destino")).toHaveTextContent("Português (Brasil)");
    expect(screen.queryByRole("combobox", { name: "Idioma de destino" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claro" })).toHaveClass("bg-primary");
    expect(screen.queryByRole("button", { name: /Salvar Preferências/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Banco local")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("ocr-key")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Escuro" }));

    await waitFor(() => expect(mockUpsertSetting).toHaveBeenCalledWith("theme", "dark"));

    await user.click(screen.getByRole("button", { name: "Ativar" }));

    await waitFor(() =>
      expect(mockUpsertSetting).toHaveBeenCalledWith("run_in_background", "true"),
    );

    await user.click(screen.getByRole("button", { name: "Editar atalho" }));
    await user.keyboard("{Control>}{Alt>}e{/Alt}{/Control}");
    await user.click(screen.getByRole("button", { name: "Salvar atalho" }));

    await waitFor(() =>
      expect(mockRegisterCaptureShortcut).toHaveBeenCalledWith("CommandOrControl+Alt+E"),
    );

    expect(mockUpsertSetting).toHaveBeenCalledWith("global_shortcut", "CommandOrControl+Alt+E");

    await user.click(screen.getByRole("button", { name: "Configurações avançadas" }));

    expect(screen.getByRole("button", { name: "Mostrar chaves" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("ocr-key")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar chaves" }));

    expect(screen.getByRole("button", { name: "Ocultar chaves" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("ocr-key")).toHaveAttribute("type", "text");
    expect(screen.getByDisplayValue("gemini-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pexels-key")).toBeInTheDocument();

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
