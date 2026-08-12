# Yocab

Aplicativo desktop para criar vocabulário em inglês a partir de conteúdos reais, como vídeos, sites, jogos, PDFs e outras janelas do Windows.

O objetivo do projeto é reduzir a fricção entre encontrar uma palavra desconhecida e transformá-la em material de estudo. O usuário captura uma área da tela, revisa o texto reconhecido, recebe tradução contextual e pode salvar palavras ou frases em uma biblioteca local.

## Origem do nome

- **Yomu** -> leitura
- **Vocabulary** -> vocabulário
- **Yocab** -> construir vocabulário através daquilo que você lê.

## Principais Funcionalidades

- Captura de área da tela pelo aplicativo ou por atalho global.
- OCR externo para reconhecer texto em imagens.
- Revisão manual do texto reconhecido antes da consulta.
- Tradução contextual com IA e fallback gratuito de tradução.
- Popup de consulta com tradução, explicação, exemplos e imagem de referência quando aplicável.
- Biblioteca local de palavras e frases salvas.
- Página da palavra com traduções, exemplos, imagens, histórico, tags e dados editáveis.
- Caderno de anotações para observações, frases próprias e tags.
- Tela de revisão com modos inglês-português, português-inglês, contexto e imagem.
- Configurações persistentes para tema, idioma, atalho e chaves de providers.
- Banco SQLite local com migrations automáticas.

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
- Tradução e IA contextual: Gemini API
- Fallback de tradução: MyMemory
- Imagens: Pexels como provider principal e Wikipedia como fallback

## Estrutura

- `app/`: aplicação Tauri com frontend React e núcleo Rust.
- `app/src/`: interface, telas, stores, schemas e services do frontend.
- `app/src-tauri/`: comandos Tauri, services, providers, repositories, migrations e integração com SQLite.
- `app/data/`: dados locais de desenvolvimento, ignorados pelo Git.

## Requisitos

- Node.js
- Rust
- Visual Studio Build Tools com toolchain C++ para Windows
- Chaves opcionais dos providers:
  - `OCR_SPACE_API_KEY`
  - `GEMINI_API_KEY`
  - `PEXELS_API_KEY`

As chaves também podem ser configuradas pela tela de Configurações do aplicativo.

## Desenvolvimento

Execute os comandos dentro de `app/`.

```powershell
npm install
npm run tauri:dev
```

Comandos úteis:

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

O projeto já possui um fluxo principal funcional com captura, OCR, consulta contextual, salvamento local, biblioteca, página da palavra, caderno, imagens de referência e revisão.

Ainda não há instalador final publicado; a distribuição será preparada depois da estabilização completa.
