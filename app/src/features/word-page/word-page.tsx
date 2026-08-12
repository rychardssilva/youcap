import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  ImageIcon,
  Languages,
  Loader2,
  MessageSquareText,
  NotebookPen,
  Save,
  WholeWord,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { userMessage } from "@/lib/user-message";
import {
  ensureLexicalRelations,
  getReferenceImages,
  getRelatedWords,
  getWordDetails,
  updateWordDetails,
  type RelatedWord,
  type WordDetails,
} from "@/services/database-service";
import { useNavigationStore } from "@/stores/navigation-store";
import { useToastStore } from "@/stores/toast-store";

const statusOptions = [
  { value: "new", label: "Nova" },
  { value: "learning", label: "Estudando" },
  { value: "difficult", label: "Difícil" },
  { value: "known", label: "Conhecida" },
  { value: "mastered", label: "Dominada" },
  { value: "archived", label: "Arquivada" },
];

export function WordPage() {
  const selectedWordId = useNavigationStore((state) => state.selectedWordId);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);
  const openNotesForWord = useNavigationStore((state) => state.openNotesForWord);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [failedWordId, setFailedWordId] = useState<string | null>(null);
  const [termInput, setTermInput] = useState("");
  const [translationInput, setTranslationInput] = useState("");
  const [statusInput, setStatusInput] = useState("new");
  const [partOfSpeechInput, setPartOfSpeechInput] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [relatedWords, setRelatedWords] = useState<RelatedWord[]>([]);
  const [isLoadingLexicalRelations, setIsLoadingLexicalRelations] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const lexicalRelationsRequestedRef = useRef<Set<string>>(new Set());
  const addToast = useToastStore((state) => state.addToast);

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

        setReferenceImages([]);
        setRelatedWords([]);
        setDetails(nextDetails);
        setFailedWordId(null);
        setTermInput(nextDetails.word.term);
        setTranslationInput(nextDetails.translations[0]?.translation ?? "");
        setStatusInput(nextDetails.word.status);
        setPartOfSpeechInput(
          nextDetails.word.part_of_speech ?? inferPartOfSpeech(nextDetails.word.term) ?? "",
        );

        const hasSynonyms = nextDetails.lexical_relations.some(
          (relation) => relation.relation_type === "synonym",
        );
        const hasAntonyms = nextDetails.lexical_relations.some(
          (relation) => relation.relation_type === "antonym",
        );

        if (
          (!hasSynonyms || !hasAntonyms) &&
          !isPhrase(nextDetails.word.term) &&
          !lexicalRelationsRequestedRef.current.has(nextDetails.word.id)
        ) {
          lexicalRelationsRequestedRef.current.add(nextDetails.word.id);
          setIsLoadingLexicalRelations(true);

          void ensureLexicalRelations(nextDetails.word.id)
            .then((updatedDetails) => {
              if (isCurrent && updatedDetails.word.id === nextDetails.word.id) {
                setDetails(updatedDetails);
                setTranslationInput(updatedDetails.translations[0]?.translation ?? "");
                setStatusInput(updatedDetails.word.status);
                setPartOfSpeechInput(
                  updatedDetails.word.part_of_speech ??
                    inferPartOfSpeech(updatedDetails.word.term) ??
                    "",
                );
              }
            })
            .catch(() => {
              if (isCurrent) {
                addToast({
                  variant: "info",
                  title: "Relações não geradas",
                  description:
                    "Não foi possível buscar sinônimos e antônimos automaticamente agora.",
                });
              }
            })
            .finally(() => {
              if (isCurrent) {
                setIsLoadingLexicalRelations(false);
              }
            });
        }

        void getRelatedWords({
          word_id: nextDetails.word.id,
          term: nextDetails.word.term,
          limit: 8,
        })
          .then((words) => {
            if (isCurrent) {
              setRelatedWords(words);
            }
          })
          .catch(() => {
            if (isCurrent) {
              setRelatedWords([]);
            }
          });

        void loadReferenceImages(nextDetails)
          .then((images) => {
            if (isCurrent) {
              setReferenceImages(images);
            }
          })
          .catch(() => {
            if (isCurrent) {
              setReferenceImages([]);
            }
          });
      })
      .catch(() => {
        if (isCurrent) {
          setFailedWordId(selectedWordId);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [addToast, selectedWordId]);

  useEffect(() => {
    if (!isStatusOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsStatusOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isStatusOpen]);

  function refreshReferenceImages() {
    if (!details || isRefreshingImages) {
      return;
    }

    setIsRefreshingImages(true);
    void loadReferenceImages(details)
      .then((images) => {
        setReferenceImages(images);
      })
      .catch(() => {
        addToast({
          variant: "error",
          title: "Erro ao atualizar imagens",
          description: "Não foi possível trocar as imagens de referência agora.",
        });
      })
      .finally(() => setIsRefreshingImages(false));
  }

  if (!selectedWordId) {
    return (
      <EmptyState
        icon={WholeWord}
        title="Nenhuma palavra selecionada"
        description="Abra os detalhes pelo popup ou pela biblioteca para ver significado, contextos e histórico."
        actionLabel="Ir para biblioteca"
        onAction={() => setCurrentView("vocabulary")}
      />
    );
  }

  if (failedWordId === selectedWordId) {
    return <ErrorState message="Não foi possível carregar os detalhes dessa palavra." />;
  }

  if (!details || details.word.id !== selectedWordId) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-md border bg-card p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span>Carregando detalhes da palavra...</span>
        </div>
      </div>
    );
  }

  const latestTranslation = details.translations[0]?.translation ?? "Tradução não registrada";
  const latestContext = details.contexts[0]?.original_text ?? "Contexto não registrado";
  const translationVariations = buildTranslationVariations(details);
  const synonyms = lexicalRelationsForType(details, "synonym");
  const antonyms = lexicalRelationsForType(details, "antonym");
  const examplesAndContexts = buildExamplesAndContexts(details);
  const grammarClass = partOfSpeechLabel(
    details.word.part_of_speech?.trim() || inferPartOfSpeech(details.word.term),
  );
  const tags = details.tags.map((tag) => tag.name);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentDetails = details;

    if (!currentDetails) {
      return;
    }

    setIsSaving(true);

    try {
      const nextPartOfSpeech = partOfSpeechInput || inferPartOfSpeech(termInput) || "";
      const updatedDetails = await updateWordDetails({
        id: currentDetails.word.id,
        term: termInput,
        translation: translationInput,
        status: statusInput,
        part_of_speech: nextPartOfSpeech,
      });

      setDetails(updatedDetails);
      addToast({
        variant: "success",
        title: "Palavra atualizada",
        description: "As informações foram salvas na biblioteca.",
      });
    } catch (err) {
      addToast({
        variant: "error",
        title: "Erro ao atualizar",
        description: userMessage(errorMessage(err)),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setCurrentView("vocabulary")}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Biblioteca
          </Button>
          <Button variant="outline" onClick={() => openNotesForWord(details.word.id)}>
            <NotebookPen className="size-4" aria-hidden="true" />
            Abrir caderno
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Palavra selecionada</p>
                <h2 className="mt-1 break-words text-3xl font-semibold">{details.word.term}</h2>
                <p className="mt-2 text-sm font-medium">{latestTranslation}</p>
                <p className="mt-2 text-sm text-muted-foreground">{latestContext}</p>
              </div>
            </div>
          </div>

          {referenceImages.length > 0 ? (
            <section className="surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="font-medium">Imagens de referência</h3>
                </div>
                {isRefreshingImages ? (
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {referenceImages.map((imageUrl) => (
                  <button
                    key={imageUrl}
                    type="button"
                    className="interactive-surface overflow-hidden rounded-md border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                    onClick={refreshReferenceImages}
                    disabled={isRefreshingImages}
                    title="Trocar imagens"
                  >
                    <img
                      className="aspect-[4/3] w-full object-cover"
                      src={imageUrl}
                      alt={`Imagem de referência para ${details.word.term}`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.closest("button")?.remove();
                      }}
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-medium">Traduções e palavras relacionadas</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {translationVariations.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Variações de tradução</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {translationVariations.map((translation) => (
                      <span key={translation} className="rounded-md bg-muted px-3 py-2 text-sm">
                        {translation}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tradução registrada.</p>
              )}

              {relatedWords.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Palavras ligadas em inglês</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {relatedWords.map((item) => (
                      <span key={item.term} className="rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="block font-medium">{item.term}</span>
                        {item.translation ? (
                          <span className="block text-xs text-muted-foreground">
                            {item.translation}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-medium">Sinônimos e Antônimos</h3>
            </div>
            {isLoadingLexicalRelations ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Buscando sinônimos e antônimos para salvar no banco...
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <LexicalRelationList
                title="Sinônimos"
                items={synonyms}
                empty="Nenhum sinônimo salvo."
              />
              <LexicalRelationList
                title="Antônimos"
                items={antonyms}
                empty="Nenhum antônimo salvo."
              />
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-medium">Contextos e exemplos</h3>
            </div>
            <div className="mt-4 space-y-3">
              {examplesAndContexts.map((item) => (
                <div key={item.id} className="surface-soft p-3 text-sm">
                  <p>{item.originalText}</p>
                  {item.translatedText ? (
                    <p className="mt-1 text-muted-foreground">{item.translatedText}</p>
                  ) : null}
                  {item.highlightedText ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Destaque: {item.highlightedText}
                    </p>
                  ) : null}
                </div>
              ))}
              {examplesAndContexts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contexto registrado.</p>
              ) : null}
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-medium">Frases próprias</h3>
              </div>
              <Button variant="outline" onClick={() => openNotesForWord(details.word.id)}>
                Abrir caderno
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {details.personal_sentences.map((sentence) => (
                <div key={sentence.id} className="surface-soft p-3 text-sm">
                  <p>{sentence.original_text}</p>
                  {sentence.translated_text ? (
                    <p className="mt-1 text-muted-foreground">{sentence.translated_text}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Atualizada em {formatDate(sentence.updated_at)}
                  </p>
                </div>
              ))}
              {details.personal_sentences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma frase própria salva para esta palavra.
                </p>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <WholeWord className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-medium">Resumo</h3>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{statusLabel(details.word.status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Idioma</dt>
                <dd className="font-medium">{details.word.language}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Classe gramatical</dt>
                <dd className="font-medium">{grammarClass}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-2 py-1 text-xs font-medium">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="font-medium">Nenhuma tag</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-medium">Histórico</h3>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow
                label="Primeira consulta"
                value={formatDate(details.history_summary.first_lookup_at)}
              />
              <SummaryRow
                label="Última consulta"
                value={formatDate(details.history_summary.last_lookup_at)}
              />
              <SummaryRow
                label="Total"
                value={`${details.history_summary.lookups_count} ${
                  details.history_summary.lookups_count === 1 ? "consulta" : "consultas"
                }`}
              />
            </dl>
          </section>

          <section className="surface p-5">
            <h3 className="font-medium">Editar informações</h3>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <label className="block text-sm">
                <span className="text-muted-foreground">Palavra original</span>
                <input
                  className="field mt-1 w-full"
                  value={termInput}
                  maxLength={160}
                  onChange={(event) => setTermInput(event.currentTarget.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-muted-foreground">Tradução principal</span>
                <input
                  className="field mt-1 w-full"
                  value={translationInput}
                  maxLength={240}
                  onChange={(event) => setTranslationInput(event.currentTarget.value)}
                />
              </label>

              <div ref={statusMenuRef} className="relative text-sm">
                <span className="text-muted-foreground">Status</span>
                <button
                  className={cn(
                    "field mt-1 flex w-full items-center gap-2 text-left transition-colors",
                    "hover:border-primary/35 hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isStatusOpen && "border-primary/40 bg-accent text-accent-foreground",
                  )}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isStatusOpen}
                  aria-label="Status"
                  onClick={() => setIsStatusOpen((current) => !current)}
                >
                  <span className="flex-1">
                    {statusOptions.find((option) => option.value === statusInput)?.label ??
                      statusLabel(statusInput)}
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 opacity-70 transition-transform", {
                      "rotate-180": isStatusOpen,
                    })}
                    aria-hidden="true"
                  />
                </button>

                {isStatusOpen ? (
                  <div
                    className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
                    role="listbox"
                    aria-label="Status"
                  >
                    {statusOptions.map((option) => {
                      const isSelected = option.value === statusInput;

                      return (
                        <button
                          key={option.value}
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left transition-colors",
                            "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                            isSelected && "bg-accent text-accent-foreground",
                          )}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setStatusInput(option.value);
                            setIsStatusOpen(false);
                          }}
                        >
                          <span className="flex-1">{option.label}</span>
                          {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <label className="block text-sm">
                <span className="text-muted-foreground">Classe gramatical</span>
                <input
                  className="field mt-1 w-full"
                  value={partOfSpeechInput || inferPartOfSpeech(termInput) || ""}
                  maxLength={80}
                  onChange={(event) => setPartOfSpeechInput(event.currentTarget.value)}
                />
              </label>

              <Button className="w-full" isLoading={isSaving} type="submit">
                <Save className="size-4" aria-hidden="true" />
                Salvar alterações
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function LexicalRelationList({
  title,
  items,
  empty,
}: {
  title: string;
  items: LexicalRelationView[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item.id} className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="block font-medium">{item.term}</span>
              {item.translation ? (
                <span className="block text-xs text-muted-foreground">{item.translation}</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

type LexicalRelationView = {
  id: string;
  term: string;
  translation: string | null;
};

type DisplayExample = {
  id: string;
  originalText: string;
  translatedText: string | null;
  highlightedText: string | null;
};

function lexicalRelationsForType(
  details: WordDetails,
  relationType: "synonym" | "antonym",
): LexicalRelationView[] {
  return details.lexical_relations
    .filter((item) => item.relation_type === relationType)
    .map((item) => ({
      id: item.id,
      term: item.term,
      translation: item.translation,
    }));
}

function buildTranslationVariations(details: WordDetails) {
  const values = details.translations.map((translation) => translation.translation);
  const termKey = details.word.normalized_term;
  const localVariations: Record<string, string[]> = {
    hidden: ["Escondido", "Oculto", "Secreto"],
    village: ["Vila", "Aldeia", "Povoado"],
    time: ["Tempo", "Hora", "Momento"],
    run: ["Correr", "Funcionar", "Esgotar"],
    twelve: ["Doze"],
    ago: ["atrás", "Faz", "Antes"],
  };

  return uniqueTextValues([...values, ...(localVariations[termKey] ?? [])]).slice(0, 8);
}

async function loadReferenceImages(details: WordDetails): Promise<string[]> {
  const candidateTerms = buildReferenceImageTerms(details);
  const images: string[] = [];
  const seen = new Set<string>();

  for (const term of candidateTerms) {
    const nextImages = await getReferenceImages(term, 12);

    for (const image of nextImages) {
      const normalizedImage = imageIdentity(image);
      if (!seen.has(normalizedImage)) {
        seen.add(normalizedImage);
        images.push(image);
      }
    }
  }

  return shuffleTextValues(images).slice(0, 4);
}

function imageIdentity(imageUrl: string): string {
  const urlWithoutQuery = imageUrl.split("?")[0] ?? imageUrl;
  const filename =
    urlWithoutQuery
      .split("/")
      .reverse()
      .find((segment) => /\.(jpe?g|png|webp)$/i.test(segment)) ?? urlWithoutQuery;

  return filename.replace(/^\d+px-/i, "").toLowerCase();
}

function shuffleTextValues(values: string[]): string[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function buildReferenceImageTerms(details: WordDetails): string[] {
  const terms = [details.word.term];
  const seen = new Set<string>();

  return terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && !isPhrase(term))
    .filter((term) => {
      const normalizedTerm = term.toLowerCase();
      if (seen.has(normalizedTerm)) {
        return false;
      }

      seen.add(normalizedTerm);
      return true;
    })
    .slice(0, 5);
}

function buildExamplesAndContexts(details: WordDetails) {
  const examples: DisplayExample[] = details.examples.map((example) => ({
    id: `example-${example.id}`,
    originalText: example.original_text,
    translatedText: example.translated_text,
    highlightedText: null,
  }));
  const contexts: DisplayExample[] = details.contexts.map((context) => ({
    id: `context-${context.id}`,
    originalText: context.original_text,
    translatedText: null,
    highlightedText: context.highlighted_text,
  }));

  const localExamples = examplesForTerm(details.word.normalized_term);

  return uniqueBySimilarText([...examples, ...contexts, ...localExamples]).slice(0, 8);
}

function examplesForTerm(term: string): DisplayExample[] {
  const examples: Record<string, Array<Omit<DisplayExample, "id" | "highlightedText">>> = {
    hidden: [
      {
        originalText: "The hidden door was behind the bookshelf.",
        translatedText: "A porta escondida ficava atrás da estante.",
      },
      {
        originalText: "She found a hidden message in the letter.",
        translatedText: "Ela encontrou uma mensagem oculta na carta.",
      },
      {
        originalText: "The village was hidden in the mountains.",
        translatedText: "A vila estava escondida nas montanhas.",
      },
      {
        originalText: "He kept his plans hidden from everyone.",
        translatedText: "Ele manteve seus planos escondidos de todos.",
      },
    ],
    village: [
      {
        originalText: "The village is quiet at night.",
        translatedText: "A vila fica silenciosa a noite.",
      },
      {
        originalText: "People in the village know each other.",
        translatedText: "As pessoas da vila se conhecem.",
      },
    ],
    time: [
      {
        originalText: "We do not have enough time.",
        translatedText: "Nós não temos tempo suficiente.",
      },
      {
        originalText: "Time passed quickly.",
        translatedText: "O tempo passou rapido.",
      },
    ],
  };

  return (examples[term] ?? []).map((example, index) => ({
    id: `local-${term}-${index}`,
    highlightedText: null,
    ...example,
  }));
}

function uniqueTextValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeComparableText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(value.trim());
  }

  return result;
}

function uniqueBySimilarText(items: DisplayExample[]) {
  const result: DisplayExample[] = [];

  for (const item of items) {
    const normalized = normalizeComparableText(item.originalText);
    if (!normalized) {
      continue;
    }

    const alreadyExists = result.some((existing) => {
      const existingNormalized = normalizeComparableText(existing.originalText);
      return (
        existingNormalized === normalized ||
        (Math.abs(existingNormalized.length - normalized.length) <= 4 &&
          (existingNormalized.includes(normalized) || normalized.includes(existingNormalized)))
      );
    });

    if (!alreadyExists) {
      result.push(item);
    }
  }

  return result;
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function isPhrase(term: string) {
  return term.split(/\s+/).filter((part) => /[A-Za-z]/.test(part)).length > 1;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Nova",
    learning: "Estudando",
    difficult: "Difícil",
    known: "Conhecida",
    mastered: "Dominada",
    archived: "Arquivada",
  };

  return labels[status] ?? status;
}

function partOfSpeechLabel(value: string | null) {
  if (!value?.trim()) {
    return "Não informada";
  }

  const labels: Record<string, string> = {
    noun: "Substantivo",
    verb: "Verbo",
    adjective: "Adjetivo",
    adverb: "Advérbio",
    pronoun: "Pronome",
    preposition: "Preposição",
    conjunction: "Conjunção",
    interjection: "Interjeição",
    determiner: "Determinante",
    number: "Numero",
  };
  const normalized = value.trim().toLowerCase();

  return labels[normalized] ?? value.trim();
}

function inferPartOfSpeech(term: string) {
  const normalizedTerm = term.trim().toLowerCase();
  const known: Record<string, string> = {
    hidden: "adjective",
    twelve: "number",
    ago: "adverb",
    village: "noun",
    time: "noun",
  };

  return known[normalizedTerm] ?? null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Não registrado";
  }

  const date = parseDatabaseDate(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseDatabaseDate(value: string) {
  const sqliteUtcPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  if (sqliteUtcPattern.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}
