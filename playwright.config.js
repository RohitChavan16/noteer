import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: 'https://noteer-test.veselarodina.cz',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
        {
            name: 'Samsung Galaxy S24',
            use: {
                userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                viewport: { width: 360, height: 780 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                defaultBrowserType: 'chromium',
            },
        },
    ],

    /* Run your local dev server before starting the tests */
    // webServer: {
    //     command: 'npm run dev',
    //     cwd: './frontend',
    //     url: 'http://localhost:5173',
    //     reuseExistingServer: !process.env.CI,
    //     timeout: 120 * 1000,
    // },
});
