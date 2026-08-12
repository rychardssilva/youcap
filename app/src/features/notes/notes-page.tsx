import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  ArrowLeft,
  Heading2,
  Highlighter,
  ImageIcon,
  Link,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Search,
} from "lucide-react";

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
  const shouldOpenNotesFocused = useNavigationStore((state) => state.shouldOpenNotesFocused);
  const consumeNotesFocusRequest = useNavigationStore((state) => state.consumeNotesFocusRequest);
  const addToast = useToastStore((state) => state.addToast);
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<WordListItem[]>([]);
  const [openedWordId, setOpenedWordId] = useState<string | null>(() =>
    shouldOpenNotesFocused ? selectedWordId : null,
  );
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [sentenceInput, setSentenceInput] = useState("");
  const [sentenceTranslationInput, setSentenceTranslationInput] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(() => shouldOpenNotesFocused);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  const selectedWord = useMemo(
    () => words.find((word) => word.id === selectedWordId) ?? null,
    [selectedWordId, words],
  );

  useEffect(() => {
    if (shouldOpenNotesFocused) {
      consumeNotesFocusRequest();
    }
  }, [consumeNotesFocusRequest, shouldOpenNotesFocused]);

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
      })
      .catch(() => {
        if (isCurrent) {
          setStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [query]);

  useEffect(() => {
    if (!openedWordId) {
      return;
    }

    let isCurrent = true;
    void getWordDetails(openedWordId)
      .then((nextDetails) => {
        if (!isCurrent) {
          return;
        }

        setDetails(nextDetails);
        const parsedNote = parseNote(nextDetails.personal_notes[0]?.note ?? "");
        setTagsInput(tagsToInput(nextDetails.tags.map((tag) => tag.name)) || parsedNote.tags);
        setNoteInput(parsedNote.body);
        window.requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = noteToEditorHtml(parsedNote.body);
          }
        });
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
  }, [openedWordId]);

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
        description: "As anotações foram atualizadas.",
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

  function syncEditor() {
    setNoteInput(editorRef.current?.innerHTML ?? "");
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  }

  function restoreEditorSelection(): Range | null {
    const range = savedSelectionRef.current;
    if (!range) {
      editorRef.current?.focus();
      return null;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current?.focus();
    return range;
  }

  function activeEditorRange() {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }

    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const currentRange = selection.getRangeAt(0);
      if (editor.contains(currentRange.commonAncestorContainer)) {
        savedSelectionRef.current = currentRange.cloneRange();
        return currentRange;
      }
    }

    return restoreEditorSelection();
  }

  function selectNodeContents(node: Node) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedSelectionRef.current = range.cloneRange();
  }

  function replaceSelectionWith(node: Node) {
    const range = activeEditorRange();
    if (!range) {
      return;
    }

    range.deleteContents();
    range.insertNode(node);
    selectNodeContents(node);
    syncEditor();
    saveEditorSelection();
  }

  function wrapSelection(tagName: keyof HTMLElementTagNameMap, configure?: (element: HTMLElement) => void) {
    const range = activeEditorRange();
    if (!range || range.collapsed) {
      editorRef.current?.focus();
      return;
    }

    const wrapper = document.createElement(tagName);
    configure?.(wrapper);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    selectNodeContents(wrapper);
    syncEditor();
  }

  function formatAsTitle() {
    const range = activeEditorRange();
    if (!range || range.collapsed) {
      editorRef.current?.focus();
      return;
    }

    const title = closestSelectionElement(range, "h2");
    if (title) {
      replaceElementWithParagraph(title);
      syncEditor();
      return;
    }

    const text = selectedLinesFromRange(range).trim() || range.toString().trim();
    if (!text) {
      return;
    }

    const titleElement = document.createElement("h2");
    titleElement.textContent = text;
    replaceSelectionWith(titleElement);
  }

  function formatAsList() {
    const range = activeEditorRange();
    if (!range || range.collapsed) {
      editorRef.current?.focus();
      return;
    }

    const activeList = closestSelectionElement(range, "ul, ol");
    if (activeList) {
      unwrapList(activeList);
      syncEditor();
      return;
    }

    const activeListItem = closestSelectionElement(range, "li");
    const parentList = activeListItem?.closest("ul, ol");
    if (parentList && editorRef.current?.contains(parentList)) {
      unwrapList(parentList);
      syncEditor();
      return;
    }

    const items = selectedLinesFromRange(range)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (items.length === 0) {
      return;
    }

    const list = document.createElement("ul");
    for (const item of items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.append(listItem);
    }

    replaceSelectionWith(list);
  }

  function highlightSelection() {
    const range = activeEditorRange();
    if (!range || range.collapsed) {
      editorRef.current?.focus();
      return;
    }

    const mark = closestSelectionElement(range, "mark");
    if (mark) {
      unwrapInlineElement(mark);
      syncEditor();
      return;
    }

    wrapSelection("mark", (element) => {
      element.style.backgroundColor = "#fff3a3";
      element.style.color = "#1f2937";
      element.style.borderRadius = "4px";
      element.style.padding = "0 2px";
    });
  }

  function boldSelection() {
    const range = activeEditorRange();
    if (!range || range.collapsed) {
      editorRef.current?.focus();
      return;
    }

    const bold = closestSelectionElement(range, "strong, b");
    if (bold) {
      unwrapInlineElement(bold);
      syncEditor();
      return;
    }

    wrapSelection("strong");
  }

  function createLink() {
    saveEditorSelection();
    const url = window.prompt("Cole o link");
    if (!url?.trim()) {
      return;
    }

    wrapSelection("a", (element) => {
      element.setAttribute("href", url.trim());
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noreferrer");
    });
  }

  function insertImage() {
    saveEditorSelection();
    imageInputRef.current?.click();
  }

  function handleImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      addToast({
        variant: "error",
        title: "Imagem inválida",
        description: "Escolha um arquivo de imagem para inserir no caderno.",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast({
        variant: "error",
        title: "Imagem muito grande",
        description: "Escolha uma imagem com até 2 MB para manter o caderno leve.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const image = document.createElement("img");
        image.src = reader.result;
        image.alt = "Imagem inserida no caderno";
        replaceSelectionWith(image);
      }
    };
    reader.onerror = () => {
      addToast({
        variant: "error",
        title: "Erro ao carregar imagem",
        description: "Não foi possível inserir a imagem selecionada.",
      });
    };
    reader.readAsDataURL(file);
  }

  function openNotebookPage(wordId: string) {
    setSelectedWordId(wordId);
    setOpenedWordId(wordId);
  }

  return (
    <div
      className={
        isFocusMode
          ? "min-h-[calc(100vh-7rem)]"
          : "grid min-h-[calc(100vh-7rem)] gap-8 xl:grid-cols-[300px_minmax(0,1fr)]"
      }
    >
      {!isFocusMode ? (
      <aside className="border-r pr-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field w-full pl-9"
            placeholder="Buscar palavra"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Clique em uma palavra ou frase para abrir sua página de anotações.
        </p>

        <div className="mt-5 space-y-1">
          {status === "loading" ? (
            <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Carregando palavras...
            </div>
          ) : null}

          {status === "error" ? (
            <p className="rounded-md px-2 py-2 text-sm text-muted-foreground">
              Não foi possível carregar o caderno.
            </p>
          ) : null}

          {words.map((word) => (
            <button
              key={word.id}
              className={`w-full rounded-md px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                word.id === openedWordId
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              type="button"
              onClick={() => openNotebookPage(word.id)}
            >
              <span className="block font-medium">{word.term}</span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {word.main_translation ?? "Tradução não registrada"}
              </span>
            </button>
          ))}
        </div>
      </aside>
      ) : null}

      {!details ? (
        <section className="flex min-h-[560px] items-center">
          <div className="max-w-2xl">
            <p className="text-sm text-muted-foreground">Caderno de anotações</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-normal">Escreva do seu jeito.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Use este espaço para transformar palavras e frases salvas em páginas de estudo:
              observações livres, comentários, exemplos próprios, links, imagens e tags.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Para começar, clique em uma palavra ou frase na lista à esquerda.
            </p>
          </div>
        </section>
      ) : (
        <form
          className={isFocusMode ? "mx-auto w-full max-w-5xl pb-12" : "mx-auto w-full max-w-4xl pb-12"}
          onSubmit={handleSubmit}
        >
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
            <div className="min-w-0">
              {isFocusMode ? (
                <button
                  className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  onClick={() => setIsFocusMode(false)}
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Caderno
                </button>
              ) : null}
              <p className="text-sm text-muted-foreground">Caderno de anotações</p>
              <h2 className="mt-2 break-words text-5xl font-semibold tracking-normal">
                {details.word.term}
              </h2>
              <p className="mt-3 text-base font-medium">
                {details.translations[0]?.translation ?? selectedWord?.main_translation}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setIsFocusMode((current) => !current)}
                title={isFocusMode ? "Voltar ao caderno" : "Maximizar anotações"}
              >
                {isFocusMode ? (
                  <Minimize2 className="size-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="size-4" aria-hidden="true" />
                )}
              </Button>
              <Button variant="outline" type="button" onClick={() => setCurrentView("word")}>
                Abrir palavra
              </Button>
              <Button type="submit" isLoading={isSaving}>
                <Save className="size-4" aria-hidden="true" />
                Salvar
              </Button>
            </div>
          </header>

          <section className="space-y-8">
            <label className="block max-w-xl text-sm">
              <span className="text-muted-foreground">Tags</span>
              <input
                className="mt-2 w-full border-0 border-b bg-transparent px-0 py-2 text-sm outline-none focus-visible:border-ring"
                value={tagsInput}
                placeholder="ex: anime, verbos"
                onChange={(event) => setTagsInput(event.currentTarget.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <ToolbarButton
                label="Título"
                icon={Heading2}
                onClick={formatAsTitle}
              />
              <ToolbarButton
                label="Lista"
                icon={List}
                onClick={formatAsList}
              />
              <ToolbarButton
                label="Destaque"
                icon={Highlighter}
                onClick={highlightSelection}
              />
              <ToolbarButton
                label="Negrito"
                icon={Bold}
                onClick={boldSelection}
              />
              <ToolbarButton label="Link" icon={Link} onClick={createLink} />
              <ToolbarButton label="Imagem" icon={ImageIcon} onClick={insertImage} />
            </div>
            <input
              ref={imageInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={handleImageSelected}
              aria-hidden="true"
              tabIndex={-1}
            />

            <label className="block text-sm">
              <span className="sr-only">Editor</span>
              <div
                id="notes-editor"
                ref={editorRef}
                className="notes-editor min-h-[52vh] w-full border-0 bg-transparent px-0 py-2 text-base leading-8 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                contentEditable
                data-placeholder="Escreva observações, comentários, listas, links, imagens e destaques..."
                onInput={syncEditor}
                onBlur={syncEditor}
                onKeyUp={saveEditorSelection}
                onMouseUp={saveEditorSelection}
                role="textbox"
                aria-label="Editor"
              />
            </label>
          </section>

          <section className="mt-10 border-t pt-8">
            <h3 className="text-lg font-medium">Frase própria</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre uma frase criada por você usando esta palavra ou expressão.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted-foreground">Minha frase</span>
                <textarea
                  className="mt-2 min-h-32 w-full resize-none rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sentenceInput}
                  onChange={(event) => setSentenceInput(event.currentTarget.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Tradução da minha frase</span>
                <textarea
                  className="mt-2 min-h-32 w-full resize-none rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sentenceTranslationInput}
                  onChange={(event) => setSentenceTranslationInput(event.currentTarget.value)}
                />
              </label>
            </div>
          </section>
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
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          onClick();
        }
      }}
      title={label}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

function selectedLinesFromRange(range: Range) {
  const fragment = range.cloneContents();
  const lines: string[] = [];
  let currentLine = "";

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      currentLine += node.textContent ?? "";
      return;
    }

    if (node instanceof HTMLBRElement) {
      lines.push(currentLine);
      currentLine = "";
      return;
    }

    const shouldBreakAfter =
      node instanceof HTMLDivElement ||
      node instanceof HTMLParagraphElement ||
      node instanceof HTMLLIElement ||
      node instanceof HTMLHeadingElement;

    node.childNodes.forEach(visit);

    if (shouldBreakAfter && currentLine.trim()) {
      lines.push(currentLine);
      currentLine = "";
    }
  }

  fragment.childNodes.forEach(visit);

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

function closestSelectionElement(range: Range, selector: string) {
  const editor = document.getElementById("notes-editor");
  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const commonElement =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  const candidates = [startElement, commonElement].filter(Boolean) as Element[];

  for (const candidate of candidates) {
    const closest = candidate.matches(selector) ? candidate : candidate.closest(selector);
    if (closest && editor?.contains(closest)) {
      return closest as HTMLElement;
    }
  }

  const selectedElements = Array.from(range.cloneContents().querySelectorAll(selector));
  if (selectedElements.length > 0) {
    return null;
  }

  return null;
}

function unwrapInlineElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  const fragment = document.createDocumentFragment();
  while (element.firstChild) {
    fragment.append(element.firstChild);
  }

  const firstChild = fragment.firstChild;
  const lastChild = fragment.lastChild;
  parent.replaceChild(fragment, element);

  selectRangeBetween(firstChild, lastChild);
}

function replaceElementWithParagraph(element: HTMLElement) {
  const paragraph = document.createElement("p");
  while (element.firstChild) {
    paragraph.append(element.firstChild);
  }

  element.replaceWith(paragraph);
  selectNodeContentsByElement(paragraph);
}

function unwrapList(list: Element) {
  const fragment = document.createDocumentFragment();
  const items = Array.from(list.querySelectorAll(":scope > li"));

  items.forEach((item, index) => {
    const paragraph = document.createElement("p");
    while (item.firstChild) {
      paragraph.append(item.firstChild);
    }
    fragment.append(paragraph);

    if (index < items.length - 1) {
      fragment.append(document.createTextNode("\n"));
    }
  });

  const firstChild = fragment.firstChild;
  const lastChild = fragment.lastChild;
  list.replaceWith(fragment);
  selectRangeBetween(firstChild, lastChild);
}

function selectNodeContentsByElement(element: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectRangeBetween(firstChild: Node | null, lastChild: Node | null) {
  if (!firstChild || !lastChild) {
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.setStartBefore(firstChild);
  range.setEndAfter(lastChild);
  selection?.removeAllRanges();
  selection?.addRange(range);
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

function noteToEditorHtml(note: string) {
  if (/<(h1|h2|h3|p|ul|ol|li|strong|b|mark|a|img|br)\b/i.test(note)) {
    return note;
  }

  return escapeHtml(note).replace(/\r?\n/g, "<br>");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}
