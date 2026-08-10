# Immersion Vocabulary

Aplicativo desktop para criar vocabulario em ingles a partir de conteudos reais, como videos, sites, jogos, PDFs e outras janelas do Windows.

O objetivo do projeto e reduzir a friccao entre encontrar uma palavra desconhecida e transforma-la em material de estudo. O usuario captura uma area da tela, revisa o texto reconhecido, recebe traducao contextual e pode salvar palavras ou frases em uma biblioteca local.

## Principais Funcionalidades

- Captura de area da tela pelo aplicativo ou por atalho global.
- OCR externo para reconhecer texto em imagens.
- Revisao manual do texto reconhecido antes da consulta.
- Traducao contextual com IA e fallback gratuito de traducao.
- Popup de consulta com traducao, explicacao, exemplos e imagem de referencia quando aplicavel.
- Biblioteca local de palavras e frases salvas.
- Pagina da palavra com traducoes, exemplos, imagens, historico, tags e dados editaveis.
- Caderno de anotacoes para observacoes, frases proprias e tags.
- Tela de revisao com modos ingles-portugues, portugues-ingles, contexto e imagem.
- Configuracoes persistentes para tema, idioma, atalho e chaves de providers.
- Banco SQLite local com migrations automaticas.

## Stack

- Tauri 2
- Rust
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- Zod
- SQLite
- SQLx

## Providers

- OCR: OCR.space API
- Traducao e IA contextual: Gemini API
- Fallback de traducao: MyMemory
- Imagens: Pexels como provider principal e Wikipedia como fallback

## Estrutura

- `app/`: aplicacao Tauri com frontend React e nucleo Rust.
- `app/src/`: interface, telas, stores, schemas e services do frontend.
- `app/src-tauri/`: comandos Tauri, services, providers, repositories, migrations e integracao com SQLite.
- `app/data/`: dados locais de desenvolvimento, ignorados pelo Git.

## Requisitos

- Node.js
- Rust
- Visual Studio Build Tools com toolchain C++ para Windows
- Chaves opcionais dos providers:
  - `OCR_SPACE_API_KEY`
  - `GEMINI_API_KEY`
  - `PEXELS_API_KEY`

As chaves tambem podem ser configuradas pela tela de Configuracoes do aplicativo.

## Desenvolvimento

Execute os comandos dentro de `app/`.

```powershell
npm install
npm run tauri:dev
```

Comandos uteis:

```powershell
npm run dev
npm run typecheck
npm run lint
npm run test:ui
npm run build
npm run cargo:check
npm run cargo:test
```

## Status

O projeto esta em fase de MVP funcional. O fluxo principal ja cobre captura, OCR, consulta contextual, salvamento local, biblioteca, pagina da palavra, caderno, imagens de referencia e revisao.

Ainda nao ha instalador final publicado; a distribuicao sera preparada depois da estabilizacao completa.
