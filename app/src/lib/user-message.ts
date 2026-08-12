const knownMessages: Array<[RegExp, string]> = [
  [
    /query text.*incomplete|text.*incomplete|incomplete query/i,
    "O texto reconhecido parece incompleto. Confira o texto capturado ou selecione uma área maior.",
  ],
  [
    /query text|source text|captured text|input text/i,
    "O texto reconhecido pode precisar de ajuste. Confira o texto capturado antes de continuar.",
  ],
  [
    /incomplete/i,
    "O texto reconhecido parece incompleto. Confira o texto capturado ou tente novamente.",
  ],
  [
    /source text contains significant typos, missing words, and truncation/i,
    "O texto reconhecido parece ter erros, palavras faltando ou trechos cortados. Confira o texto capturado antes de salvar.",
  ],
  [
    /missing words/i,
    "O texto reconhecido pode estar com palavras faltando. Confira o texto capturado antes de salvar.",
  ],
  [
    /significant typos/i,
    "O texto reconhecido pode conter erros. Confira o texto capturado antes de salvar.",
  ],
  [
    /truncation/i,
    "A captura pode ter cortado parte do texto. Tente selecionar uma área um pouco maior.",
  ],
  [
    /quota|resource_exhausted|rate limit|exceeded your current quota/i,
    "O limite gratuito do Gemini foi atingido. Tente novamente mais tarde ou use outra chave de API.",
  ],
  [
    /api key.*missing|gemini api key ausente|api key ausente/i,
    "Configure a chave do Gemini para receber tradução e contexto por IA.",
  ],
  [
    /invalid api key|credential|credencial|permission_denied|unauthorized|forbidden/i,
    "A chave de API parece inválida ou sem permissão. Confira a chave nas configurações.",
  ],
  [
    /timeout|demorou demais/i,
    "A operação demorou demais para responder. Tente novamente ou selecione uma área menor.",
  ],
  [
    /failed to fetch|network|dns|connection|conectar|conexao|conexão/i,
    "Não foi possível conectar ao serviço externo. Confira sua internet e tente novamente.",
  ],
  [
    /json|invalid_lookup_response|resposta.*invalida/i,
    "A IA respondeu em um formato inesperado. A tradução básica será usada quando possível.",
  ],
  [
    /ocr\.space.*recusou|ocr.*credential|ocr.*credencial/i,
    "O OCR recusou a imagem ou a chave configurada. Confira a chave do OCR.space nas configurações.",
  ],
  [
    /falha ao processar ocr|ocr.*processing/i,
    "Não foi possível reconhecer o texto nessa imagem. Tente selecionar uma área mais nítida.",
  ],
  [
    /shortcut|atalho|already registered|hotkey/i,
    "Não foi possível registrar esse atalho. Tente outra combinação nas configurações.",
  ],
  [
    /database|sqlite|migration|constraint|unique/i,
    "Não foi possível acessar ou atualizar o banco local. Tente novamente e confira se o app tem permissão de escrita.",
  ],
  [
    /monitor|screen|display|permission|permissao|permissão|access denied/i,
    "Não foi possível acessar a tela para captura. Confira permissões do sistema e tente novamente.",
  ],
];

export function userMessage(message: string | null | undefined) {
  const rawMessage = message?.trim();

  if (!rawMessage) {
    return "Não foi possível concluir a operação.";
  }

  for (const [pattern, translatedMessage] of knownMessages) {
    if (pattern.test(rawMessage)) {
      return translatedMessage;
    }
  }

  if (looksLikeEnglish(rawMessage)) {
    return "Aviso da consulta: confira o texto reconhecido antes de continuar.";
  }

  return stripTechnicalPrefix(rawMessage);
}

function stripTechnicalPrefix(message: string) {
  return message.replace(/^[a-z_]+:\s*/i, "");
}

function looksLikeEnglish(message: string) {
  const lowerMessage = message.toLowerCase();
  const englishWords = [
    "the",
    "query",
    "text",
    "source",
    "contains",
    "missing",
    "invalid",
    "failed",
    "error",
    "unavailable",
    "incomplete",
    "please",
    "try",
  ];

  return englishWords.some((word) => new RegExp(`\\b${word}\\b`).test(lowerMessage));
}
