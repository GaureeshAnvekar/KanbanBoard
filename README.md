# Sportlingo Kanban Assessment

A polished Kanban-style task board built with React, TypeScript, Supabase anonymous auth, and drag-and-drop task movement. The board is designed around a clean Linear/Notion-inspired workspace with thoughtful empty, loading, and error states.

## Features

- Anonymous Supabase guest session on first launch.
- User-scoped tasks with Supabase Row Level Security.
- Four default board columns: To Do, In Progress, In Review, Done.
- Create tasks with title, description, priority, and optional due date.
- Create a small team with member names, optional avatar URLs, and profile colors.
- Assign one or more team members to each task.
- Display assignee avatars directly on task cards.
- Drag tasks between columns with optimistic persistence on drop.
- Reorder tasks within a column with persisted card positions.
- Responsive layout, loading skeletons, empty states, and inline error handling.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the app:

```bash
npm run dev
```

## Supabase

1. Create a Supabase project.
2. Enable anonymous sign-ins in Authentication settings.
3. Run the SQL files in `supabase/migrations/` in order through the SQL editor or Supabase CLI.
4. Use the public anon key in `.env.local`. Do not use or commit a service role key.

The migrations create `public.tasks`, `public.team_members`, and `public.task_assignees`, enable RLS, and add policies that only allow each authenticated guest to read, create, update, and delete their own rows.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
