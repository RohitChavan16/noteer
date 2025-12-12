/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: [
        '@storybook/addon-essentials',
        '@storybook/addon-themes',
    ],
    framework: {
        name: '@storybook/react-vite',
        options: {},
    },
    viteFinal: async (config) => {
        return config;
    },
};

export default config;
