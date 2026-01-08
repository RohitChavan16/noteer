# Noteer Frontend

React/Vite single-page application for Noteer.
Built with Mantine UI, Zustand (State), TanStack Query (Data Fetching), and Dexie.js (Local-First Database).

## Key Features

- **Local-First Architecture**: Uses Dexie.js (IndexedDB) for offline storage and syncs when online.
- **End-to-End Encryption**: Notes are encrypted on the client side before syncing.
- **Rich Text & Checklists**: flexible note types.
- **Dark Mode**: Fully supported via Mantine.

## Project Structure

- `src/`
    - `components/`: React components (UI)
    - `stores/`: Global state (Zustand: auth, notes, sync)
    - `hooks/`: Custom React hooks (useSync, useNotes, etc.)
    - `db/`: Dexie database schema and configuration
    - `services/`: API clients and Sync logic
    - `routes/`: Frontend routing (React Router)
    - `utils/`: Helpers and Crypto logic

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint
