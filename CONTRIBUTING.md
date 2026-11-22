# Как се добавя модул в MARAUDER

1. Създай нов файл в подходящата папка под `modules/` (`recon/`, `audits/`, `reporting/` или `git-ops/`), като вземеш за основа `modules/_template-module.js`.
2. Опиши `name`, `title`, `category`, `author`, `description`, `options` и асинхронната функция `run(ctx)`.
3. Тествай модула локално върху собствена или изрично разрешена тестова среда.
4. Провери синтаксиса на файла с `node --check <файл>` преди commit / Pull Request.
