# Yocab

Aplicativo desktop Windows para capturar texto da tela, reconhecer com OCR, consultar tradução/contexto e salvar vocabulário localmente.

## Origem do nome

- **Yomu** -> leitura
- **Vocabulary** -> vocabulário
- **Yocab** -> construir vocabulário através daquilo que você lê.

## Requisitos

- Windows 10/11
- Node.js instalado
- Rust instalado
- Visual Studio Build Tools com componentes C++ para compilar o Tauri

## Rodar em desenvolvimento

```powershell
npm install
npm run tauri:dev
```

Se a porta `1420` estiver ocupada, feche o processo Vite/Tauri antigo antes de iniciar de novo.

## Configurações

No app, abra **Configurações** para definir:

- Tema claro ou escuro
- Atalho global de captura
- Idioma de destino: português Brasil
- Chave do OCR.space
- Chave do Gemini
- Chave do Pexels

As preferências são salvas no SQLite local. As chaves também podem ser definidas por variáveis de ambiente:

```powershell
$env:OCR_SPACE_API_KEY="sua-chave"
$env:GEMINI_API_KEY="sua-chave"
$env:PEXELS_API_KEY="sua-chave"
```

## Banco local

Em desenvolvimento, o banco fica em:

```text
app/data/banco_de_dados.sqlite
```

Em versão instalada, o banco fica no diretório de dados do aplicativo do Windows.

## Logs técnicos

Em desenvolvimento, logs técnicos ficam em:

```text
app/data/logs/yocab.log
```

Eles registram falhas de inicialização, captura, OCR, consulta e salvamento sem expor mensagens técnicas diretamente para o usuário.

## Comandos de qualidade

```powershell
npm run typecheck
npm run lint
npm run test:ui
npm run cargo:test
npm run cargo:check
npm run build
```

## Gerar versão distribuível

```powershell
npm run tauri build
```

Os artefatos do instalador ficam em:

```text
app/src-tauri/target/release/bundle
```
