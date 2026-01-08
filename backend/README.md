# Noteer Backend

Node.js/Express backend for the Noteer application.
Handles authentication (OIDC/JWT), note storage (PostgreSQL), synchronization, and file management.

## Project Structure

- `src/`
    - `config/`: Configuration (DB, Passport, constants)
    - `db/`: Database connection and helper functions
    - `middleware/`: Express middleware (Auth, Rate Limit, Validation)
    - `routes/`: API route definitions
    - `utils/`: Utility functions (Logger, formatting)
    - `app.js`: Application setup
    - `server.js`: Server entry point

## Scripts

- `npm start`: Run in production
- `npm run dev`: Run in development (nodemon)
- `npm test`: Run tests

## Environment Variables

See `.env.example` in the root directory for required environment variables.
