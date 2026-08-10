import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bold,
  Heading2,
  Highlighter,
  ImageIcon,
  Link,
  List,
  Loader2,
  NotebookPen,
  Save,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import {
  getWordDetails,
  searchWords,
  updateWordDetails,
  type WordDetails,
  type WordListItem,
} from "@/services/database-service";
import { useNavigationStore } from "@/stores/navigation-store";
import { useToastStore } from "@/stores/toast-store";

const PAGE_SIZE = 30;

type ParsedNote = {
  tags: string;
  body: string;
};

export function NotesPage() {
  const selectedWordId = useNavigationStore((state) => state.selectedWordId);
  const setSelectedWordId = useNavigationStore((state) => state.setSelectedWordId);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);
  const addToast = useToastStore((state) => state.addToast);
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<WordListItem[]>([]);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [sentenceInput, setSentenceInput] = useState("");
  const [sentenceTranslationInput, setSentenceTranslationInput] = useState("");

  const selectedWord = useMemo(
    () => words.find((word) => word.id === selectedWordId) ?? null,
    [selectedWordId, words],
  );

  useEffect(() => {
    let isCurrent = true;

    void Promise.resolve()
      .then(() => {
        if (isCurrent) {
          setStatus("loading");
        }

        return searchWords({
          query: query.trim() || undefined,
          sort: "last_lookup",
          limit: PAGE_SIZE,
          offset: 0,
        });
      })
      .then((response) => {
        if (!isCurrent) {
          return;
        }

        setWords(response.items);
        setStatus("ready");

        if (!selectedWordId && response.items[0]) {
          setSelectedWordId(response.items[0].id);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [query, selectedWordId, setSelectedWordId]);

  useEffect(() => {
    if (!selectedWordId) {
      return;
    }

    let isCurrent = true;
    void getWordDetails(selectedWordId)
      .then((nextDetails) => {
        if (!isCurrent) {
          return;
        }

        setDetails(nextDetails);
        const parsedNote = parseNote(nextDetails.personal_notes[0]?.note ?? "");
        setTagsInput(tagsToInput(nextDetails.tags.map((tag) => tag.name)) || parsedNote.tags);
        setNoteInput(parsedNote.body);
        setSentenceInput(nextDetails.personal_sentences[0]?.original_text ?? "");
        setSentenceTranslationInput(nextDetails.personal_sentences[0]?.translated_text ?? "");
      })
      .catch(() => {
        if (isCurrent) {
          setDetails(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedWordId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!details) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedDetails = await updateWordDetails({
        id: details.word.id,
        personal_note: noteInput,
        personal_sentence: sentenceInput,
        personal_sentence_translation: sentenceTranslationInput,
        tags: tagsInput,
      });

      setDetails(updatedDetails);
      addToast({
        variant: "success",
        title: "Caderno salvo",
        description: "As anotacoes foram atualizadas.",
      });
    } catch (error) {
      addToast({
        variant: "error",
        title: "Erro ao salvar caderno",
        description: userMessage(errorMessage(error)),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function insertSnippet(before: string, after = "") {
    const textarea = document.getElementById("notes-editor") as HTMLTextAreaElement | null;

    if (!textarea) {
      setNoteInput((current) => `${current}${before}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noteInput.slice(start, end);
    const nextText = `${noteInput.slice(0, start)}${before}${selectedText || "texto"}${after}${noteInput.slice(end)}`;
    setNoteInput(nextText);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + (selectedText || "texto").length,
      );
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Buscar palavra"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>

        <div className="space-y-2">
          {status === "loading" ? (
            <div className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Carregando palavras...
            </div>
          ) : null}

          {status === "error" ? (
            <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
              Nao foi possivel carregar o caderno.
            </p>
          ) : null}

          {words.map((word) => (
            <button
              key={word.id}
              className={`w-full rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                word.id === selectedWordId
                  ? "border-primary bg-primary/10"
                  : "bg-card hover:border-primary/60"
              }`}
              type="button"
              onClick={() => setSelectedWordId(word.id)}
            >
              <span className="block font-medium">{word.term}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {word.main_translation ?? "Traducao nao registrada"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {!details ? (
        <EmptyState
          icon={NotebookPen}
          title="Nenhuma palavra selecionada"
          description="Escolha uma palavra da lista para criar anotacoes, tags e frases proprias."
        />
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Caderno de Anotacoes</p>
                <h2 className="mt-1 text-2xl font-semibold">{details.word.term}</h2>
                <p className="mt-1 text-sm font-medium">
                  {details.translations[0]?.translation ?? selectedWord?.main_translation}
                </p>
              </div>
              <Button variant="outline" type="button" onClick={() => setCurrentView("word")}>
                Abrir palavra
              </Button>
            </div>
          </section>

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <label className="block text-sm">
              <span className="text-muted-foreground">Tags</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={tagsInput}
                maxLength={160}
                placeholder="ex: anime, verbos"
                onChange={(event) => setTagsInput(event.currentTarget.value)}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <ToolbarButton
                label="Titulo"
                icon={Heading2}
                onClick={() => insertSnippet("\n## ")}
              />
              <ToolbarButton label="Lista" icon={List} onClick={() => insertSnippet("\n- ")} />
              <ToolbarButton
                label="Destaque"
                icon={Highlighter}
                onClick={() => insertSnippet("==", "==")}
              />
              <ToolbarButton
                label="Negrito"
                icon={Bold}
                onClick={() => insertSnippet("**", "**")}
              />
              <ToolbarButton
                label="Link"
                icon={Link}
                onClick={() => insertSnippet("[", "](https://)")}
              />
              <ToolbarButton
                label="Imagem"
                icon={ImageIcon}
                onClick={() => insertSnippet("![descricao](", ")")}
              />
            </div>

            <label className="mt-4 block text-sm">
              <span className="text-muted-foreground">Editor</span>
              <textarea
                id="notes-editor"
                className="mt-1 min-h-72 w-full resize-y rounded-md border bg-background px-3 py-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={noteInput}
                maxLength={5000}
                placeholder="Escreva observacoes livres, listas, links, imagens e destaques..."
                onChange={(event) => setNoteInput(event.currentTarget.value)}
              />
            </label>
          </section>

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <h3 className="font-semibold">Frase propria</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted-foreground">Minha frase</span>
                <textarea
                  className="mt-1 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sentenceInput}
                  maxLength={600}
                  onChange={(event) => setSentenceInput(event.currentTarget.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Traducao da minha frase</span>
                <textarea
                  className="mt-1 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sentenceTranslationInput}
                  maxLength={600}
                  onChange={(event) => setSentenceTranslationInput(event.currentTarget.value)}
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving}>
              <Save className="size-4" aria-hidden="true" />
              Salvar caderno
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Heading2;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-9 px-3 text-sm"
      type="button"
      onClick={onClick}
      title={label}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

function parseNote(note: string): ParsedNote {
  const lines = note.split(/\r?\n/);
  if (lines[0]?.startsWith("# ")) {
    lines.shift();
  }
  const tagsLine = lines[0]?.startsWith("Tags:") ? (lines.shift() ?? "") : "";

  return {
    tags: tagsLine.replace(/^Tags:\s*/, "").trim(),
    body: lines.join("\n").trim(),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}
