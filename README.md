# Learn Words

Small Next.js project with Mantine UI components, internal API routes, and MySQL access in the same app.

## Setup

Use Node 20 or newer:

```bash
nvm use
```

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

Configure `.env.local` with your MySQL credentials:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=dbEnglish
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_WORDS_TABLE=english_word_bank
MYSQL_WORDS_LIMIT=50
```

`MYSQL_WORDS_LIMIT` controls the default number of words loaded by the app. The API can still override it with `GET /api/words?limit=100`.
Use `offset` to navigate through more rows, for example `GET /api/words?limit=10&offset=10`.

The app reads useful learning fields from `english_word_bank`, including:

- `word_or_expression`
- `cefr_level`
- `word_type`
- `spanish_translation`
- `meaning_en`
- `example_en`
- `example_es`
- `theme`
- `ielts_relevance`
- `learning_status`

The table also lets you update `learning_status` inline. That update is handled by `PATCH /api/words/:id`.

Run the app:

```bash
npm run dev
```

Open the page at `http://localhost:3000`.

The list route is available at `http://localhost:3000/api/words`.
