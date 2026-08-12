import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotesPage } from "@/features/notes/notes-page";
import { useNavigationStore } from "@/stores/navigation-store";

const mockSearchWords = vi.fn();
const mockGetWordDetails = vi.fn();
const mockUpdateWordDetails = vi.fn();

vi.mock("@/services/database-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/database-service")>(
    "@/services/database-service",
  );

  return {
    ...actual,
    searchWords: (...args: unknown[]) => mockSearchWords(...args),
    getWordDetails: (...args: unknown[]) => mockGetWordDetails(...args),
    updateWordDetails: (...args: unknown[]) => mockUpdateWordDetails(...args),
  };
});

describe("Caderno de anotações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNavigationStore.setState({
      currentView: "notes",
      selectedWordId: "word-1",
      shouldOpenNotesFocused: true,
    });

    mockSearchWords.mockResolvedValue({
      items: [
        {
          id: "word-1",
          term: "car",
          normalized_term: "car",
          language: "en",
          part_of_speech: "noun",
          difficulty: 0,
          status: "new",
          created_at: "2026-08-05T10:00:00Z",
          updated_at: "2026-08-05T10:00:00Z",
          main_translation: "carro",
          latest_context: null,
          first_lookup_at: "2026-08-05T10:00:00Z",
          last_lookup_at: "2026-08-05T10:00:00Z",
          lookups_count: 1,
        },
      ],
      total: 1,
      limit: 30,
      offset: 0,
    });
    mockGetWordDetails.mockResolvedValue(wordDetails());
    mockUpdateWordDetails.mockResolvedValue(wordDetails());
  });

  it("aplica formatações da toolbar no texto selecionado", async () => {
    const user = userEvent.setup();

    render(<NotesPage />);

    const editor = await screen.findByRole("textbox", { name: "Editor" });
    editor.innerHTML = "important line";
    selectEditorText(editor.firstChild ?? editor);

    fireEvent.mouseDown(screen.getByRole("button", { name: "Negrito" }));
    expect(editor.innerHTML).toContain("<strong>important line</strong>");
    fireEvent.mouseDown(screen.getByRole("button", { name: "Negrito" }));
    expect(editor.innerHTML).not.toContain("<strong>");

    editor.innerHTML = "heading";
    selectEditorText(editor.firstChild ?? editor);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Título" }));
    expect(editor.innerHTML).toContain("<h2>heading</h2>");
    fireEvent.mouseDown(screen.getByRole("button", { name: "Título" }));
    expect(editor.innerHTML).not.toContain("<h2>");

    editor.innerHTML = "one<br>two";
    selectEditorText(editor);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Lista" }));
    expect(editor.innerHTML).toContain("<ul>");
    expect(editor.innerHTML).toContain("<li>one</li>");
    expect(editor.innerHTML).toContain("<li>two</li>");
    fireEvent.mouseDown(screen.getByRole("button", { name: "Lista" }));
    expect(editor.innerHTML).not.toContain("<ul>");
    expect(editor.innerHTML).not.toContain("<li>");

    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() =>
      expect(mockUpdateWordDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "word-1",
          personal_note: expect.stringContaining("one"),
        }),
      ),
    );
  }, 15000);
});

function selectEditorText(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.mouseUp(node);
}
function wordDetails() {
  return {
    word: {
      id: "word-1",
      term: "car",
      normalized_term: "car",
      language: "en",
      part_of_speech: "noun",
      difficulty: 0,
      status: "new",
      created_at: "2026-08-05T10:00:00Z",
      updated_at: "2026-08-05T10:00:00Z",
    },
    translations: [
      {
        id: "translation-1",
        language: "pt-BR",
        translation: "carro",
        kind: "main",
        source: "manual",
        created_at: "2026-08-05T10:00:00Z",
      },
    ],
    contexts: [],
    examples: [],
    lookups: [],
    history_summary: {
      first_lookup_at: "2026-08-05T10:00:00Z",
      last_lookup_at: "2026-08-05T10:00:00Z",
      lookups_count: 1,
    },
    lexical_relations: [],
    personal_notes: [],
    personal_sentences: [],
    tags: [],
    reviews: [],
  };
}
