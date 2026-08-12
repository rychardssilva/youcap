import { render, screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/app/app-shell";
import { useNavigationStore } from "@/stores/navigation-store";
import { useVocabularyStore } from "@/stores/vocabulary-store";

const mockSearchWords = vi.fn();
const mockGetWordDetails = vi.fn();
const mockUpdateWordDetails = vi.fn();
const mockGetRelatedWords = vi.fn();
const mockEnsureLexicalRelations = vi.fn();

vi.mock("@/services/database-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/database-service")>(
    "@/services/database-service",
  );

  return {
    ...actual,
    searchWords: (...args: unknown[]) => mockSearchWords(...args),
    getWordDetails: (...args: unknown[]) => mockGetWordDetails(...args),
    ensureLexicalRelations: (...args: unknown[]) => mockEnsureLexicalRelations(...args),
    getRelatedWords: (...args: unknown[]) => mockGetRelatedWords(...args),
    updateWordDetails: (...args: unknown[]) => mockUpdateWordDetails(...args),
  };
});

describe("fluxo Biblioteca -> Palavra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNavigationStore.setState({ currentView: "vocabulary", selectedWordId: null });
    useVocabularyStore.setState({ query: "", sort: "last_lookup", refreshToken: 0 });

    mockSearchWords.mockResolvedValue({
      items: [
        {
          id: "word-1",
          term: "Twelve",
          normalized_term: "twelve",
          language: "en",
          part_of_speech: "number",
          difficulty: 1,
          status: "new",
          created_at: "2026-07-28T10:00:00Z",
          updated_at: "2026-07-28T10:00:00Z",
          main_translation: "Doze",
          latest_context: "Twelve years ago the Village Hidden",
          first_lookup_at: "2026-07-28T10:00:00Z",
          last_lookup_at: "2026-07-28T10:05:00Z",
          lookups_count: 2,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    mockGetWordDetails.mockResolvedValue(wordDetails({ translation: "Doze", status: "new" }));
    mockGetRelatedWords.mockResolvedValue([
      { term: "dozen", translation: "duzia", source: "gemini" },
    ]);
    mockEnsureLexicalRelations.mockImplementation(async () => wordDetails({ translation: "Doze", status: "new" }));
    mockUpdateWordDetails.mockResolvedValue(
      wordDetails({ translation: "Doze revisado", status: "learning" }),
    );
  });

  it("abre uma palavra pela biblioteca, salva edicao e volta", async () => {
    const user = userEvent.setup();

    render(<AppShell />);

    await waitFor(() => expect(mockSearchWords).toHaveBeenCalled());
    const wordButton = await screen.findByRole("button", { name: /Twelve/i });
    await user.click(wordButton);
    await waitFor(() => expect(mockGetWordDetails).toHaveBeenCalledWith("word-1"));
    expect(await screen.findByText("Palavra selecionada")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Tradução principal"));
    await user.type(screen.getByLabelText("Tradução principal"), "Doze revisado");
    await user.click(screen.getByRole("button", { name: /Status/i }));
    await user.click(screen.getByRole("option", { name: /Estudando/i }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    expect(mockUpdateWordDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "word-1",
        translation: "Doze revisado",
        status: "learning",
      }),
    );
    expect(await screen.findByText("Palavra atualizada")).toBeInTheDocument();

    const libraryButtons = screen.getAllByRole("button", { name: "Biblioteca" });
    await user.click(libraryButtons[libraryButtons.length - 1]);
    expect(await screen.findByPlaceholderText("Pesquisar por palavra ou tradução")).toBeInTheDocument();
  }, 15000);

  it("mostra sinônimos e antônimos salvos no banco", async () => {
    useNavigationStore.setState({ currentView: "word", selectedWordId: "word-1" });
    mockGetWordDetails.mockResolvedValue(
      wordDetails({
        term: "car",
        normalizedTerm: "car",
        translation: "carro",
        status: "new",
        lexicalRelations: [
          {
            id: "synonym-1",
            term: "automobile",
            relation_type: "synonym",
            translation: "automóvel",
            source: "gemini",
            created_at: "2026-07-28T10:00:00Z",
          },
          {
            id: "antonym-1",
            term: "pedestrian",
            relation_type: "antonym",
            translation: "pedestre",
            source: "gemini",
            created_at: "2026-07-28T10:00:00Z",
          },
        ],
      }),
    );
    mockGetRelatedWords.mockResolvedValue([]);

    render(<AppShell />);

    expect(await screen.findByText("automobile")).toBeInTheDocument();
    expect(screen.getAllByText("automóvel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pedestrian").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pedestre").length).toBeGreaterThan(0);
  });
});

function wordDetails({
  term = "Twelve",
  normalizedTerm = "twelve",
  translation,
  status,
  lexicalRelations = [],
}: {
  term?: string;
  normalizedTerm?: string;
  translation: string;
  status: string;
  lexicalRelations?: Array<{
    id: string;
    term: string;
    relation_type: "synonym" | "antonym";
    translation: string;
    source: string;
    created_at: string;
  }>;
}) {
  return {
    word: {
      id: "word-1",
      term,
      normalized_term: normalizedTerm,
      language: "en",
      part_of_speech: "number",
      difficulty: 1,
      status,
      created_at: "2026-07-28T10:00:00Z",
      updated_at: "2026-07-28T10:00:00Z",
    },
    translations: [
      {
        id: "translation-1",
        language: "pt-BR",
        translation,
        kind: "main",
        source: "manual",
        created_at: "2026-07-28T10:00:00Z",
      },
    ],
    contexts: [
      {
        id: "context-1",
        original_text: "Twelve years ago the Village Hidden",
        highlighted_text: null,
        source: "gemini",
        created_at: "2026-07-28T10:00:00Z",
      },
    ],
    examples: [
      {
        id: "example-1",
        original_text: "Twelve years ago",
        translated_text: "Doze anos atrás",
        source: "gemini",
        created_at: "2026-07-28T10:00:00Z",
      },
    ],
    lookups: [
      {
        id: "lookup-1",
        query: "Twelve years ago the Village Hidden",
        source: "gemini",
        duration_ms: 1200,
        created_at: "2026-07-28T10:05:00Z",
      },
    ],
    history_summary: {
      first_lookup_at: "2026-07-28T10:00:00Z",
      last_lookup_at: "2026-07-28T10:05:00Z",
      lookups_count: 2,
    },
    lexical_relations: lexicalRelations,
    personal_notes: [],
    personal_sentences: [],
    tags: [],
    reviews: [],
  };
}
