# 🛠️ Рекомендованные настройки VSCode

Для оптимальной разработки скопируйте файлы в `.vscode/`

## Рекомендованные расширения

Создайте `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "streetsidesoftware.code-spell-checker",
    "streetsidesoftware.code-spell-checker-russian",
    "usernamehw.errorlens",
    "gruntfuggly.todo-tree",
    "eamodio.gitlens",
    "pkief.material-icon-theme",
    "wayou.vscode-todo-highlight"
  ]
}
```

## Настройки редактора

Создайте `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.rulers": [100, 120],

  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,

  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",

  "eslint.enable": true,
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],

  "tailwindCSS.includeLanguages": {
    "typescript": "typescript",
    "typescriptreact": "typescriptreact"
  },

  "cSpell.words": [
    "Neuro",
    "GUARDIAN",
    "Ozon",
    "Wildberries",
    "Yookassa",
    "Zustand",
    "Vercel",
    "Telegram",
    "Sentinel"
  ],
  "cSpell.language": "en,ru"
}
```

## Полезные расширения

| Расширение                    | Описание                      |
| ----------------------------- | ----------------------------- |
| **ESLint**                    | Линтинг JavaScript/TypeScript |
| **Prettier**                  | Форматирование кода           |
| **Tailwind CSS IntelliSense** | Автодополнение классов        |
| **Error Lens**                | Показывает ошибки inline      |
| **GitLens**                   | Продвинутый Git               |
| **TODO Tree**                 | Список TODO в проекте         |
| **Code Spell Checker**        | Проверка орфографии           |
