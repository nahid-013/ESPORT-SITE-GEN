# EsportsArena — Генератор сайта киберспортивных матчей

Статический генератор сайта с расписанием киберспортивных матчей на основе [PandaScore API](https://pandascore.co).

## Структура

```
esports-site/
├── src/
│   └── generator.js   # Основной генератор
├── output/            # Сгенерированный сайт (3 HTML-файла)
│   ├── index.html     # Матчи сегодня    → /
│   ├── yesterday.html # Матчи вчера      → /yesterday
│   └── tomorrow.html  # Матчи завтра     → /tomorrow
├── package.json
└── README.md
```

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Получение API-токена

Зарегистрируйтесь на [pandascore.co/pricing](https://pandascore.co/pricing) и получите токен (бесплатный тариф: 1000 запросов/час).

### 3. Генерация сайта

```bash
# Через переменную окружения (рекомендуется)
PANDASCORE_TOKEN=your_token_here npm run generate

# Или задайте токен в src/generator.js (строка const API_TOKEN = ...)
npm run generate
```

### 4. Просмотр локально

```bash
npm run serve
# → http://localhost:3000
```

## Деплой

### Nginx (рекомендуется)

Скопируйте папку `output/` в корень сайта. Добавьте в конфиг Nginx чистые URL (без параметров):

```nginx
server {
    root /var/www/esportsarena;
    index index.html;

    # Матчи сегодня
    location = / {
        try_files /index.html =404;
    }

    # Матчи вчера — чистый URL /yesterday
    location = /yesterday {
        try_files /yesterday.html =404;
    }

    # Матчи завтра — чистый URL /tomorrow
    location = /tomorrow {
        try_files /tomorrow.html =404;
    }
}
```

### GitHub Pages / Netlify / Vercel

Укажите папку `output/` как publish directory. Добавьте файл редиректов:

**Netlify** (`output/_redirects`):
```
/yesterday  /yesterday.html  200
/tomorrow   /tomorrow.html   200
```

**Vercel** (`vercel.json` в корне):
```json
{
  "rewrites": [
    { "source": "/yesterday", "destination": "/yesterday.html" },
    { "source": "/tomorrow",  "destination": "/tomorrow.html"  }
  ]
}
```

## Автообновление (cron)

Для ежечасного обновления добавьте в crontab:

```bash
0 * * * * cd /path/to/esports-site && PANDASCORE_TOKEN=your_token node src/generator.js >> /var/log/esports-gen.log 2>&1
```

## Что включено

- ✅ **3 страницы**: вчера / сегодня / завтра
- ✅ **SEO**: `<title>`, `<meta description>`, canonical, Open Graph, Twitter Card
- ✅ **Schema.org**: Organization, WebSite, WebPage, ItemList, SportsEvent
- ✅ **Чистые URL**: без GET-параметров (`/yesterday`, `/tomorrow`)
- ✅ **Дизайн**: киберспортивный dark theme, адаптивная сетка, анимации
- ✅ **Карточки матчей**: логотипы команд, счёт, время, лига, статус (LIVE/Скоро/Завершён)
- ✅ **Itemscope/itemprop**: микроразметка прямо в карточках матчей

## Переменные конфигурации (src/generator.js)

| Переменная   | Описание                          |
|-------------|-----------------------------------|
| `API_TOKEN` | Токен PandaScore                  |
| `SITE_NAME` | Название сайта                    |
| `SITE_URL`  | Базовый URL сайта (для canonical) |
| `OUT_DIR`   | Папка для генерации               |
