import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  ImageIcon,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/user-message";
import {
  getReferenceImages,
  getWordDetails,
  searchWords,
  updateWordDetails,
  type WordDetails,
  type WordListItem,
} from "@/services/database-service";
import { useNavigationStore } from "@/stores/navigation-store";
import { useToastStore } from "@/stores/toast-store";

type ReviewMode = "en_to_pt" | "pt_to_en" | "context" | "image";
type ReviewRating = "again" | "hard" | "good" | "easy";

type SessionStats = {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
};

const initialStats: SessionStats = {
  reviewed: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
};

export function ReviewPage() {
  const addToast = useToastStore((state) => state.addToast);
  const setSelectedWordId = useNavigationStore((state) => state.setSelectedWordId);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);
  const [queue, setQueue] = useState<WordListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mode, setMode] = useState<ReviewMode>("en_to_pt");
  const [answerVisible, setAnswerVisible] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const [checkResult, setCheckResult] = useState<"correct" | "wrong" | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<SessionStats>(initialStats);

  const currentWord = queue[currentIndex] ?? null;
  const progressLabel = queue.length > 0 ? `${currentIndex + 1} de ${queue.length}` : "0 de 0";

  const card = useMemo(
    () => buildReviewCard(mode, currentWord, details),
    [mode, currentWord, details],
  );

  useEffect(() => {
    let isCurrent = true;

    void Promise.resolve()
      .then(() => {
        if (isCurrent) {
          setStatus("loading");
        }

        return searchWords({
          sort: "last_lookup",
          limit: 24,
          offset: 0,
        });
      })
      .then((response) => {
        if (!isCurrent) {
          return;
        }

        const nextQueue = sortReviewQueue(response.items);
        setQueue(nextQueue);
        setCurrentIndex(0);
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
  }, []);

  useEffect(() => {
    if (!currentWord) {
      return;
    }

    let isCurrent = true;

    void Promise.resolve()
      .then(() => {
        if (isCurrent) {
          setAnswerVisible(false);
          setAnswerInput("");
          setCheckResult(null);
          setDetails(null);
        }

        return getWordDetails(currentWord.id);
      })
      .then((nextDetails) => {
        if (isCurrent) {
          setDetails(nextDetails);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setDetails(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [currentWord]);

  useEffect(() => {
    if (!currentWord || mode !== "image") {
      return;
    }

    let isCurrent = true;

    void Promise.resolve()
      .then(() => {
        if (isCurrent) {
          setIsLoadingImages(true);
          setReferenceImages([]);
        }

        return getReferenceImages(currentWord.term, 4);
      })
      .then((images) => {
        if (isCurrent) {
          setReferenceImages(images);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setReferenceImages([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingImages(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [currentWord, mode]);

  async function submitReview(rating: ReviewRating) {
    if (!currentWord) {
      return;
    }

    setIsSaving(true);

    try {
      await updateWordDetails({
        id: currentWord.id,
        status: statusFromRating(rating),
        review_rating: rating,
        review_scheduled_for: nextReviewDate(rating),
      });

      setStats((current) => ({
        ...current,
        reviewed: current.reviewed + 1,
        [rating]: current[rating] + 1,
      }));
      goNext();
    } catch (error) {
      addToast({
        variant: "error",
        title: "Erro ao registrar revisao",
        description: userMessage(errorMessage(error)),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function goNext() {
    setAnswerVisible(false);
    setAnswerInput("");
    setCheckResult(null);
    setCurrentIndex((index) => Math.min(index + 1, queue.length));
  }

  function restartSession() {
    setStats(initialStats);
    setCurrentIndex(0);
    setAnswerVisible(false);
    setAnswerInput("");
    setCheckResult(null);
  }

  function checkAnswer() {
    const isCorrect = isAcceptableAnswer(answerInput, card.answer);
    setCheckResult(isCorrect ? "correct" : "wrong");
    setAnswerVisible(true);
  }

  function changeMode(nextMode: ReviewMode) {
    setMode(nextMode);
    setAnswerVisible(false);
    setAnswerInput("");
    setCheckResult(null);
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-md border bg-card p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span>Preparando fila de revisao...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={XCircle}
        title="Nao foi possivel carregar a revisao"
        description="Tente abrir a pagina novamente depois."
      />
    );
  }

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={BookOpenCheck}
        title="Nenhuma palavra para revisar"
        description="Salve palavras na biblioteca para montar sessoes de revisao."
      />
    );
  }

  if (!currentWord) {
    return (
      <section className="mx-auto max-w-2xl rounded-md border bg-card p-6 text-card-foreground">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold">Sessao concluida</h2>
            <p className="text-sm text-muted-foreground">
              {stats.reviewed} {stats.reviewed === 1 ? "palavra revisada" : "palavras revisadas"}.
            </p>
          </div>
        </div>
        <StatsGrid stats={stats} />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={restartSession}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Revisar novamente
          </Button>
          <Button variant="outline" onClick={() => setCurrentView("vocabulary")}>
            Abrir biblioteca
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Sessao de revisao</p>
            <h2 className="text-2xl font-semibold">{progressLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModeButton active={mode === "en_to_pt"} onClick={() => changeMode("en_to_pt")}>
              EN &gt; PT
            </ModeButton>
            <ModeButton active={mode === "pt_to_en"} onClick={() => changeMode("pt_to_en")}>
              PT &gt; EN
            </ModeButton>
            <ModeButton active={mode === "context"} onClick={() => changeMode("context")}>
              Contexto
            </ModeButton>
            <ModeButton active={mode === "image"} onClick={() => changeMode("image")}>
              Imagem
            </ModeButton>
          </div>
        </div>

        <section className="rounded-md border bg-card p-6 text-card-foreground">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{card.promptLabel}</p>
              <h3 className="mt-2 break-words text-3xl font-semibold">{card.prompt}</h3>
            </div>
            {mode === "image" ? (
              <ImageIcon className="size-7 text-primary" aria-hidden="true" />
            ) : null}
          </div>

          {mode === "image" ? (
            <div className="mt-5">
              {isLoadingImages ? (
                <div className="flex h-44 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                </div>
              ) : referenceImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {referenceImages.map((imageUrl) => (
                    <div key={imageUrl} className="overflow-hidden rounded-md border bg-background">
                      <img
                        className="aspect-[4/3] w-full object-cover"
                        src={imageUrl}
                        alt={`Imagem de revisao para ${currentWord.term}`}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.closest("div")?.remove();
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-md border bg-background text-center text-sm text-muted-foreground">
                  Nenhuma imagem encontrada para esta palavra.
                </div>
              )}
            </div>
          ) : null}

          {mode === "en_to_pt" || mode === "pt_to_en" || mode === "image" ? (
            <div className="mt-5 rounded-md border bg-background p-4">
              <label className="block text-sm">
                <span className="text-muted-foreground">
                  {mode === "pt_to_en" ? "Sua traducao em ingles" : "Sua traducao em portugues"}
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={answerInput}
                  placeholder="Digite sua resposta"
                  onChange={(event) => {
                    setAnswerInput(event.currentTarget.value);
                    setCheckResult(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      checkAnswer();
                    }
                  }}
                />
              </label>
              {checkResult ? (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-md border p-3 text-sm ${
                    checkResult === "correct"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-destructive/40 bg-destructive/10 text-foreground"
                  }`}
                >
                  {checkResult === "correct" ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <MessageCircleQuestion
                      className="mt-0.5 size-4 text-destructive"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="font-medium">
                      {checkResult === "correct" ? "Resposta correta" : "Confira a resposta"}
                    </p>
                    {checkResult === "wrong" ? (
                      <p className="mt-1 text-muted-foreground">
                        Resposta esperada: <span className="font-medium">{card.answer}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 rounded-md border bg-background p-4">
            {answerVisible ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.answerLabel}</p>
                  <p className="mt-1 text-xl font-semibold">{card.answer}</p>
                </div>
                {card.context ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Contexto</p>
                    <p className="mt-1 text-sm leading-6">{card.context}</p>
                  </div>
                ) : null}
                {card.example ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Exemplo</p>
                    <p className="mt-1 text-sm leading-6">{card.example}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-32 items-center justify-center text-center text-muted-foreground">
                <div>
                  <Eye className="mx-auto size-7" aria-hidden="true" />
                  <p className="mt-2 text-sm">Tente lembrar antes de revelar a resposta.</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setAnswerVisible(true)}>
                <Eye className="size-4" aria-hidden="true" />
                Mostrar resposta
              </Button>
              {mode === "en_to_pt" || mode === "pt_to_en" || mode === "image" ? (
                <Button onClick={checkAnswer} disabled={!answerInput.trim()}>
                  Conferir
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isLoading={isSaving}
                onClick={() => void submitReview("again")}
              >
                Errei
              </Button>
              <Button
                variant="outline"
                isLoading={isSaving}
                onClick={() => void submitReview("hard")}
              >
                Dificil
              </Button>
              <Button isLoading={isSaving} onClick={() => void submitReview("good")}>
                Bom
              </Button>
              <Button isLoading={isSaving} onClick={() => void submitReview("easy")}>
                Facil
              </Button>
            </div>
          </div>
        </section>
      </section>

      <aside className="space-y-5">
        <section className="rounded-md border bg-card p-5 text-card-foreground">
          <h3 className="font-semibold">Resumo da sessao</h3>
          <StatsGrid stats={stats} />
        </section>

        <section className="rounded-md border bg-card p-5 text-card-foreground">
          <h3 className="font-semibold">Palavra atual</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Termo" value={currentWord.term} />
            <SummaryRow label="Traducao" value={currentWord.main_translation ?? "Nao registrada"} />
            <SummaryRow label="Status" value={statusLabel(currentWord.status)} />
            <SummaryRow label="Aparicoes" value={`${currentWord.lookups_count}`} />
          </dl>
          <div className="mt-4 grid gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedWordId(currentWord.id);
                setCurrentView("word");
              }}
            >
              <Search className="size-4" aria-hidden="true" />
              Abrir detalhes
            </Button>
            <Button variant="ghost" onClick={goNext}>
              Pular
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function buildReviewCard(mode: ReviewMode, word: WordListItem | null, details: WordDetails | null) {
  const term = word?.term ?? "";
  const translation =
    word?.main_translation ?? details?.translations[0]?.translation ?? "Sem traducao";
  const context = word?.latest_context ?? details?.contexts[0]?.original_text ?? null;
  const example = details?.examples[0]?.original_text ?? null;

  if (mode === "pt_to_en") {
    return {
      promptLabel: "Traducao em portugues",
      prompt: translation,
      answerLabel: "Termo em ingles",
      answer: term,
      context,
      example,
    };
  }

  if (mode === "context") {
    return {
      promptLabel: "Contexto original",
      prompt: context ?? term,
      answerLabel: "Palavra e traducao",
      answer: `${term} - ${translation}`,
      context,
      example,
    };
  }

  if (mode === "image") {
    return {
      promptLabel: "Revisao por imagem",
      prompt: "Qual e a traducao desta imagem?",
      answerLabel: "Traducao",
      answer: translation,
      context,
      example,
    };
  }

  return {
    promptLabel: "Termo em ingles",
    prompt: term,
    answerLabel: "Traducao",
    answer: translation,
    context,
    example,
  };
}

function sortReviewQueue(words: WordListItem[]) {
  const statusWeight: Record<string, number> = {
    difficult: 0,
    learning: 1,
    new: 2,
    known: 3,
    mastered: 4,
    archived: 5,
  };

  return [...words]
    .filter((word) => word.status !== "archived")
    .sort((a, b) => {
      const statusDiff = (statusWeight[a.status] ?? 2) - (statusWeight[b.status] ?? 2);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return b.lookups_count - a.lookups_count;
    });
}

function nextReviewDate(rating: ReviewRating) {
  const daysByRating: Record<ReviewRating, number> = {
    again: 1,
    hard: 2,
    good: 4,
    easy: 7,
  };
  const date = new Date();
  date.setDate(date.getDate() + daysByRating[rating]);

  return date.toISOString().slice(0, 10);
}

function statusFromRating(rating: ReviewRating) {
  const statuses: Record<ReviewRating, string> = {
    again: "difficult",
    hard: "learning",
    good: "known",
    easy: "mastered",
  };

  return statuses[rating];
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button variant={active ? "default" : "outline"} className="h-9 px-3 text-sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function isAcceptableAnswer(input: string, expected: string) {
  const normalizedInput = normalizeAnswer(input);
  const normalizedExpected = normalizeAnswer(expected);

  if (!normalizedInput || !normalizedExpected) {
    return false;
  }

  if (normalizedInput === normalizedExpected) {
    return true;
  }

  const expectedParts = normalizedExpected.split(/\s*[,;/]\s*/).filter(Boolean);

  if (expectedParts.some((part) => normalizedInput === part)) {
    return true;
  }

  return normalizedExpected.includes(normalizedInput) && normalizedInput.length >= 4;
}

function normalizeAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,;/]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function StatsGrid({ stats }: { stats: SessionStats }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <SummaryRow label="Revisadas" value={`${stats.reviewed}`} />
      <SummaryRow label="Erros" value={`${stats.again}`} />
      <SummaryRow label="Dificeis" value={`${stats.hard}`} />
      <SummaryRow label="Boas" value={`${stats.good + stats.easy}`} />
    </dl>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
