import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../src/styles/index.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        backgrounds: {
            disable: true, // Using theme switcher instead
        },
        layout: 'centered',
    },
    decorators: [
        withThemeByDataAttribute({
            themes: {
                dark: 'dark',
                light: 'light',
            },
            defaultTheme: 'dark',
            attributeName: 'data-theme',
        }),
        (Story) => (
            <div style={{ minHeight: '200px', padding: '20px' }}>
                <Story />
            </div>
        ),
    ],
};

export default preview;
