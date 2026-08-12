import { useState } from "react";
import {
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Library,
  NotebookText,
  PanelTopOpen,
  SearchCheck,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/components/ui/button";
import { upsertSetting } from "@/services/settings-service";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useToastStore } from "@/stores/toast-store";

const apiGuideUrl =
  "https://docs.google.com/document/d/1Y5fqx_ABCPKW2rb1c6CsdQSU46AQFO3_DoMqLuIfjDw/edit?usp=sharing";

const onboardingSteps = [
  {
    eyebrow: "Bem-vindo ao Yocab",
    title: "Construa vocabulário com o que você lê.",
    description:
      "Capture textos de vídeos, sites, jogos, PDFs ou mangás. O Yocab reconhece o texto, traduz com contexto e transforma isso em material de estudo.",
    icon: BookOpen,
    bullets: [
      "Você estuda a partir de conteúdo real.",
      "Palavras e frases ficam salvas localmente no seu computador.",
      "O app foi feito para ser rápido, discreto e não quebrar sua imersão.",
    ],
  },
  {
    eyebrow: "Primeira configuração",
    title: "Configure as chaves quando quiser usar OCR, IA e imagens.",
    description:
      "As chaves ficam salvas apenas neste computador. Para começar, abra Configurações e use Configurações avançadas.",
    icon: KeyRound,
    action: {
      label: "Abrir guia de configuração",
      url: apiGuideUrl,
    },
    bullets: [
      "OCR.space reconhece o texto da imagem.",
      "Gemini ajuda na tradução contextual e explicações.",
      "Pexels melhora as imagens de referência para palavras concretas.",
    ],
  },
  {
    eyebrow: "Captura",
    title: "Use o atalho ou o botão de captura.",
    description:
      "O atalho padrão abre a seleção de área. Depois é só arrastar sobre o trecho que você quer entender.",
    icon: Camera,
    bullets: [
      "Você pode alterar o atalho em Configurações.",
      "A seleção pode ser cancelada com Esc.",
      "Escolha uma área pequena e focada para melhorar o OCR.",
    ],
  },
  {
    eyebrow: "Revisão do OCR",
    title: "Confira o texto reconhecido antes de consultar.",
    description:
      "Se o OCR errar uma palavra, corrija manualmente antes de pedir a tradução. Isso melhora muito o resultado.",
    icon: SearchCheck,
    bullets: [
      "Para frases, mantenha a frase inteira.",
      "Para palavra isolada, deixe apenas a palavra desejada.",
      "Depois clique em Consultar para abrir o resultado.",
    ],
  },
  {
    eyebrow: "Popup",
    title: "Veja o essencial sem sair do fluxo.",
    description:
      "O popup mostra tradução, explicação simples, frase original, exemplos e imagem quando fizer sentido.",
    icon: PanelTopOpen,
    bullets: [
      "Use Salvar para mandar o conteúdo para a Biblioteca.",
      "Use Detalhes para abrir a Página da Palavra.",
      "Frases nem sempre terão imagem, porque podem ser ambíguas.",
    ],
  },
  {
    eyebrow: "Biblioteca e caderno",
    title: "Organize o que você salvou.",
    description:
      "A Biblioteca guarda palavras e frases. O Caderno permite criar anotações livres e frases próprias vinculadas ao vocabulário.",
    icon: Library,
    bullets: [
      "Pesquise palavras pela tradução ou pelo termo original.",
      "Abra a Página da Palavra para ver exemplos, imagens, tags e histórico.",
      "Use o Caderno como uma página limpa de estudo pessoal.",
    ],
  },
  {
    eyebrow: "Revisão",
    title: "A tela de Revisão ainda está em preparação.",
    description:
      "Ela já existe como base, mas ainda não é a parte mais estável do app. Por enquanto, use principalmente Captura, Biblioteca, Página da Palavra e Caderno.",
    icon: NotebookText,
    bullets: [
      "A ideia é revisar por tradução, contexto e imagem.",
      "O agendamento e o algoritmo de revisão serão refinados depois.",
      "Se algo parecer incompleto nessa tela, é esperado nesta versão.",
    ],
  },
];

export function OnboardingModal() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const closeOnboarding = useOnboardingStore((state) => state.closeOnboarding);
  const addToast = useToastStore((state) => state.addToast);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  if (!isOpen) {
    return null;
  }

  async function finishOnboarding() {
    try {
      setIsFinishing(true);
      if ("__TAURI_INTERNALS__" in window) {
        await upsertSetting("onboarding_completed", "true");
      } else {
        window.localStorage.setItem("yocab.onboarding_completed", "true");
      }
      closeOnboarding();
      setCurrentStep(0);
    } catch {
      addToast({
        variant: "error",
        title: "Não foi possível salvar o tutorial",
        description: "O tutorial foi fechado, mas pode aparecer novamente na próxima abertura.",
      });
      closeOnboarding();
    } finally {
      setIsFinishing(false);
    }
  }

  function skipOnboarding() {
    void finishOnboarding();
  }

  async function openGuide(url: string) {
    try {
      if ("__TAURI_INTERNALS__" in window) {
        await openUrl(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      addToast({
        variant: "error",
        title: "Não foi possível abrir o guia",
        description: "Abra o guia pelas Configurações avançadas ou tente novamente.",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <section
        className="surface w-full max-w-2xl overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {step.eyebrow}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="size-8"
            onClick={skipOnboarding}
            aria-label="Fechar tutorial"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="px-7 py-7">
          <p className="text-sm text-muted-foreground">
            Etapa {currentStep + 1} de {onboardingSteps.length}
          </p>
          <h2 id="onboarding-title" className="mt-3 max-w-xl text-3xl font-semibold leading-tight">
            {step.title}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            {step.description}
          </p>

          <div className="mt-6 space-y-3">
            {step.bullets.map((bullet) => (
              <div className="flex gap-3 text-sm leading-6" key={bullet}>
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {step.action ? (
            <Button
              className="mt-6"
              variant="outline"
              type="button"
              onClick={() => void openGuide(step.action.url)}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {step.action.label}
            </Button>
          ) : null}

          <div className="mt-7 flex items-center gap-1">
            {onboardingSteps.map((item, index) => (
              <span
                key={item.title}
                className={
                  index === currentStep
                    ? "h-1.5 w-8 rounded-full bg-primary"
                    : "h-1.5 w-2 rounded-full bg-muted"
                }
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <Button
            variant="ghost"
            type="button"
            onClick={skipOnboarding}
            disabled={isFinishing}
          >
            Pular tutorial
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
              disabled={isFirstStep || isFinishing}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Voltar
            </Button>
            {isLastStep ? (
              <Button type="button" isLoading={isFinishing} onClick={finishOnboarding}>
                Começar a usar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  setCurrentStep((value) => Math.min(onboardingSteps.length - 1, value + 1))
                }
              >
                Próximo
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
