import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  ImageIcon,
  Languages,
  Loader2,
  MessageSquareText,
  Save,
  WholeWord,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import {
  getReferenceImages,
  getRelatedWords,
  getWordDetails,
  updateWordDetails,
  type RelatedWord,
  type WordDetails,
} from "@/services/database-service";
import { useNavigationStore } from "@/stores/navigation-store";
import { useToastStore } from "@/stores/toast-store";

export function WordPage() {
  const selectedWordId = useNavigationStore((state) => state.selectedWordId);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [failedWordId, setFailedWordId] = useState<string | null>(null);
  const [termInput, setTermInput] = useState("");
  const [translationInput, setTranslationInput] = useState("");
  const [statusInput, setStatusInput] = useState("new");
  const [partOfSpeechInput, setPartOfSpeechInput] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [relatedWords, setRelatedWords] = useState<RelatedWord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
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
  }, [selectedWordId]);

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
          description: "Nao foi possivel trocar as imagens de referencia agora.",
        });
      })
      .finally(() => setIsRefreshingImages(false));
  }

  if (!selectedWordId) {
    return (
      <EmptyState
        icon={WholeWord}
        title="Nenhuma palavra selecionada"
        description="Abra os detalhes pelo popup ou pela biblioteca para ver significado, contextos e historico."
        actionLabel="Ir para biblioteca"
        onAction={() => setCurrentView("vocabulary")}
      />
    );
  }

  if (failedWordId === selectedWordId) {
    return <ErrorState message="Nao foi possivel carregar os detalhes dessa palavra." />;
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

  const latestTranslation = details.translations[0]?.translation ?? "Traducao nao registrada";
  const latestContext = details.contexts[0]?.original_text ?? "Contexto nao registrado";
  const translationVariations = buildTranslationVariations(details);
  const synonyms = lexicalRelationsWithFallback(details, "synonym");
  const antonyms = lexicalRelationsWithFallback(details, "antonym");
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
        description: "As informacoes foram salvas na biblioteca.",
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
    <div className="space-y-5">
      <div>
        <Button variant="ghost" onClick={() => setCurrentView("vocabulary")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Biblioteca
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5">
          <div className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Palavra selecionada</p>
                <h2 className="mt-1 break-words text-2xl font-semibold">{details.word.term}</h2>
                <p className="mt-2 text-sm font-medium">{latestTranslation}</p>
                <p className="mt-2 text-sm text-muted-foreground">{latestContext}</p>
              </div>
            </div>
          </div>

          {referenceImages.length > 0 ? (
            <section className="rounded-md border bg-card p-5 text-card-foreground">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold">Imagens de referencia</h3>
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
                    className="overflow-hidden rounded-md border bg-muted text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                    onClick={refreshReferenceImages}
                    disabled={isRefreshingImages}
                    title="Trocar imagens"
                  >
                    <img
                      className="aspect-[4/3] w-full object-cover"
                      src={imageUrl}
                      alt={`Imagem de referencia para ${details.word.term}`}
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

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">Traducoes e palavras relacionadas</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {translationVariations.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Variacoes de traducao</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {translationVariations.map((translation) => (
                      <span key={translation} className="rounded-md border px-3 py-2 text-sm">
                        {translation}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma traducao registrada.</p>
              )}

              {relatedWords.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Palavras ligadas em ingles</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {relatedWords.map((item) => (
                      <span key={item.term} className="rounded-md border px-3 py-2 text-sm">
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

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center gap-2">
              <Languages className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">Sinonimos e antonimos</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <LexicalRelationList
                title="Sinonimos"
                items={synonyms}
                empty="Nenhum sinonimo salvo."
              />
              <LexicalRelationList
                title="Antonimos"
                items={antonyms}
                empty="Nenhum antonimo salvo."
              />
            </div>
          </section>

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">Contextos e exemplos</h3>
            </div>
            <div className="mt-4 space-y-3">
              {examplesAndContexts.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
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

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">Frases proprias</h3>
              </div>
              <Button variant="outline" onClick={() => setCurrentView("notes")}>
                Abrir caderno
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {details.personal_sentences.map((sentence) => (
                <div key={sentence.id} className="rounded-md border p-3 text-sm">
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
                  Nenhuma frase propria salva para esta palavra.
                </p>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center gap-2">
              <WholeWord className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">Resumo</h3>
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
                      <span key={tag} className="rounded border px-2 py-1 text-xs font-medium">
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

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">Historico</h3>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow
                label="Primeira consulta"
                value={formatDate(details.history_summary.first_lookup_at)}
              />
              <SummaryRow
                label="Ultima consulta"
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

          <section className="rounded-md border bg-card p-5 text-card-foreground">
            <h3 className="font-semibold">Editar informacoes</h3>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <label className="block text-sm">
                <span className="text-muted-foreground">Palavra original</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={termInput}
                  maxLength={160}
                  onChange={(event) => setTermInput(event.currentTarget.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-muted-foreground">Traducao principal</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={translationInput}
                  maxLength={240}
                  onChange={(event) => setTranslationInput(event.currentTarget.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={statusInput}
                  onChange={(event) => setStatusInput(event.currentTarget.value)}
                >
                  <option value="new">Nova</option>
                  <option value="learning">Estudando</option>
                  <option value="difficult">Dificil</option>
                  <option value="known">Conhecida</option>
                  <option value="mastered">Dominada</option>
                  <option value="archived">Arquivada</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-muted-foreground">Classe gramatical</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={partOfSpeechInput || inferPartOfSpeech(termInput) || ""}
                  maxLength={80}
                  onChange={(event) => setPartOfSpeechInput(event.currentTarget.value)}
                />
              </label>

              <Button className="w-full" isLoading={isSaving} type="submit">
                <Save className="size-4" aria-hidden="true" />
                Salvar alteracoes
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
            <span key={item.id} className="rounded-md border px-3 py-2 text-sm">
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

function lexicalRelationsWithFallback(
  details: WordDetails,
  relationType: "synonym" | "antonym",
): LexicalRelationView[] {
  const savedRelations = details.lexical_relations
    .filter((item) => item.relation_type === relationType)
    .map((item) => ({
      id: item.id,
      term: item.term,
      translation: item.translation,
    }));

  if (savedRelations.length > 0) {
    return savedRelations;
  }

  const fallback = lexicalRelationFallbacks[details.word.normalized_term]?.[relationType] ?? [];

  return fallback.map((item, index) => ({
    id: `fallback-${relationType}-${details.word.normalized_term}-${index}`,
    ...item,
  }));
}

const lexicalRelationFallbacks: Record<
  string,
  {
    synonym: Array<{ term: string; translation: string | null }>;
    antonym: Array<{ term: string; translation: string | null }>;
  }
> = {
  car: {
    synonym: [
      { term: "automobile", translation: "automovel" },
      { term: "vehicle", translation: "veiculo" },
    ],
    antonym: [{ term: "pedestrian", translation: "pedestre" }],
  },
  hidden: {
    synonym: [
      { term: "concealed", translation: "escondido" },
      { term: "secret", translation: "secreto" },
    ],
    antonym: [{ term: "visible", translation: "visivel" }],
  },
  village: {
    synonym: [
      { term: "hamlet", translation: "aldeia pequena" },
      { term: "settlement", translation: "assentamento" },
    ],
    antonym: [{ term: "city", translation: "cidade" }],
  },
  run: {
    synonym: [
      { term: "sprint", translation: "correr rapidamente" },
      { term: "operate", translation: "funcionar" },
    ],
    antonym: [{ term: "walk", translation: "caminhar" }],
  },
  time: {
    synonym: [
      { term: "period", translation: "periodo" },
      { term: "moment", translation: "momento" },
    ],
    antonym: [{ term: "timelessness", translation: "atemporalidade" }],
  },
  twelve: {
    synonym: [{ term: "dozen", translation: "duzia" }],
    antonym: [{ term: "zero", translation: "zero" }],
  },
};

function buildTranslationVariations(details: WordDetails) {
  const values = details.translations.map((translation) => translation.translation);
  const termKey = details.word.normalized_term;
  const localVariations: Record<string, string[]> = {
    hidden: ["Escondido", "Oculto", "Secreto"],
    village: ["Vila", "Aldeia", "Povoado"],
    time: ["Tempo", "Hora", "Momento"],
    run: ["Correr", "Funcionar", "Esgotar"],
    twelve: ["Doze"],
    ago: ["Atras", "Faz", "Antes"],
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
        translatedText: "A porta escondida ficava atras da estante.",
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
        translatedText: "Nos nao temos tempo suficiente.",
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
    difficult: "Dificil",
    known: "Conhecida",
    mastered: "Dominada",
    archived: "Arquivada",
  };

  return labels[status] ?? status;
}

function partOfSpeechLabel(value: string | null) {
  if (!value?.trim()) {
    return "Nao informada";
  }

  const labels: Record<string, string> = {
    noun: "Substantivo",
    verb: "Verbo",
    adjective: "Adjetivo",
    adverb: "Adverbio",
    pronoun: "Pronome",
    preposition: "Preposicao",
    conjunction: "Conjuncao",
    interjection: "Interjeicao",
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
    return "Nao registrado";
  }

  const date = parseDatabaseDate(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponivel";
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
