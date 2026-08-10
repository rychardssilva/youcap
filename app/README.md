# Immersion Vocabulary

Aplicativo desktop Windows para capturar texto da tela, reconhecer com OCR, consultar traducao/contexto e salvar vocabulario localmente.

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

## Configuracoes

No app, abra **Configuracoes** para definir:

- Tema claro ou escuro
- Atalho global de captura
- Idioma de destino do MVP: Portugues Brasil
- Chave do OCR.space
- Chave do Gemini

As preferencias sao salvas no SQLite local. As chaves tambem podem ser definidas por variaveis de ambiente:

```powershell
$env:OCR_SPACE_API_KEY="sua-chave"
$env:GEMINI_API_KEY="sua-chave"
```

## Banco local

Em desenvolvimento, o banco fica em:

```text
app/data/banco_de_dados.sqlite
```

Em versao instalada, o banco fica no diretorio de dados do aplicativo do Windows.

## Logs tecnicos

Em desenvolvimento, logs tecnicos ficam em:

```text
app/data/logs/immersion-vocabulary.log
```

Eles registram falhas de inicializacao, captura, OCR, consulta e salvamento sem expor mensagens tecnicas diretamente para o usuario.

## Comandos de qualidade

```powershell
npm run typecheck
npm run lint
npm run test:ui
npm run cargo:test
npm run cargo:check
npm run build
```

## Gerar versao distribuivel

```powershell
npm run tauri build
```

Os artefatos do instalador ficam em:

```text
app/src-tauri/target/release/bundle
```
