# Yocab

Aplicativo desktop para criar vocabulário em inglês a partir de conteúdos reais que o usuário já consome, como mangás, livros, jogos, PDFs, sites, documentações, vídeos e outras janelas do Windows.

O objetivo do projeto é reduzir a fricção entre encontrar uma palavra desconhecida e transformá-la em material de estudo. O Yocab pode funcionar em segundo plano e permite capturar palavras, frases ou trechos diretamente da tela. Após a captura, o sistema reconhece o texto, permite revisão manual, identifica os termos presentes e apresenta informações úteis para o aprendizado, como tradução para português do Brasil, explicação contextual, frases de exemplo, imagens de apoio e palavras relacionadas.

Tudo que o usuário salva passa a formar uma biblioteca local de vocabulário, com páginas individuais para palavras e frases, caderno de anotações e recursos de revisão.

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

- Windows 10/11
- Node.js
- Rust
- Visual Studio Build Tools com toolchain C++ para Windows
- Chaves dos providers:
  - `OCR_SPACE_API_KEY`
  - `GEMINI_API_KEY`
  - `PEXELS_API_KEY`

As chaves devem ser configuradas pela tela de Configurações do aplicativo.

## Download

A versão distribuível do Yocab fica disponível em **GitHub Releases**:

https://github.com/rychardssilva/immersion-vocabulary/releases

Para instalar no Windows, baixe o arquivo da versão desejada, por exemplo:

```text
Yocab-Setup-1.0.0.exe
```

O instalador é publicado como anexo da Release, não como arquivo versionado dentro do código-fonte.

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
npm run security:secrets
```

## Segurança e privacidade

- O app pode enviar a imagem capturada, o texto reconhecido ou termos de busca para providers externos configurados pelo usuário: OCR.space, Gemini, Pexels, Wikipedia e MyMemory.
- As chaves de API ficam salvas somente no computador do usuário, no banco local do aplicativo. Elas não devem ser colocadas em commits, prints públicos ou arquivos versionados.
- O arquivo `.env.example` deve manter apenas placeholders vazios.
- Antes de publicar ou commitar uma versão, rode `npm run security:secrets` dentro de `app/` para procurar chaves reais acidentalmente adicionadas ao projeto.
- Em desenvolvimento, dados locais ficam em `app/data/`, pasta ignorada pelo Git.

## Status

Esta é a versão **1.0** do Yocab.

O projeto já possui um fluxo principal funcional com captura, OCR, consulta contextual, salvamento local, biblioteca, página da palavra, caderno e imagens de referência.

A página de **Revisão** já existe, mas ainda está em uma etapa inicial.
