# Contributing to Noteer

## E2E Testing Environment Setup

To run End-to-End tests, you need to set up a specific test environment where the admin user has pre-configured encryption keys. This ensures tests are reproducible.

### 1. Start Docker Container

Run the following command to start the container with the required test configuration:

```bash
docker run -d \
  --name noteer-test \
  -p 3000:3000 \
  -v noteer-db:/var/lib/postgresql/data \
  -v noteer-data:/var/lib/noteer \
  -e ADMIN_EMAIL=admin@test.com \
  -e ADMIN_PASSWORD=test123 \
  -e JWT_SECRET=e2e-test-secret-do-not-use-in-prod \
  -e NOTE_VERSION_LIMIT=10 \
  -e REGISTRATION_ENABLED=true \
  -e LOG_LEVEL=debug
  noteer:test
```

> **Note:** The `JWT_SECRET` is hardcoded for test reproducibility. **NEVER** use this secret in production.

### 2. Configure Admin Encryption Keys

After the container starts (wait ~5-10 seconds), you must seed the database with the test admin's encryption keys. This matches the test mnemonic used in `e2e/tests/helpers.js`.

Run this command from the project root:

```bash
sleep 5
cat e2e/test-admin-keys.sql | docker exec -i noteer-test psql -U postgres -d noteer
```

### 3. Run Tests

```bash
cd e2e
npx playwright test
```
