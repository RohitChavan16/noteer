
export const NOTE_COLORS = [
    {
        id: 'default',
        light: '#ffffff',
        dark: '#25262b',
        lightLabel: 'var(--mantine-color-text)',
        darkLabel: 'var(--mantine-color-text)'
    },
    {
        id: 'red',
        light: '#ffe3e3', // red.1
        dark: '#ffc9c9', // red.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'orange',
        light: '#ffe8cc', // orange.1
        dark: '#ffd8a8', // orange.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'yellow',
        light: '#fff3bf', // yellow.1
        dark: '#ffec99', // yellow.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'green',
        light: '#d3f9d8', // green.1
        dark: '#b2f2bb', // green.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'teal',
        light: '#c3fae8', // teal.1
        dark: '#96f2d7', // teal.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'blue',
        light: '#d0ebff', // blue.1
        dark: '#a5d8ff', // blue.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'purple',
        light: '#e5dbff', // grape.1
        dark: '#d0bfff', // grape.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'pink',
        light: '#ffdeeb', // pink.1
        dark: '#fcc2d7', // pink.3
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'brown',
        light: '#f4fce3', // lime.1 (brown is tricky in mantine, substituting closest earth tone if specific note needed, or keeping orange.2)
        // Let's stick to the previous 'brown' which was likely orange-based.
        // Old brown: light '#ffd8a8' (orange.2), dark '#5c3a1d'
        // Let's use a distinct milky coffee color
        light: '#f0e6cc',
        dark: '#e3d5b8',
        lightLabel: '#000000',
        darkLabel: '#000000'
    },
    {
        id: 'gray',
        light: '#f8f9fa', // gray.0
        dark: '#343a40', // gray.8 (Keep gray dark, as it's often used for "neutral")
        lightLabel: '#000000',
        darkLabel: '#ffffff'
    },
];

export const getNoteColor = (colorId, isDark) => {
    const color = NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
    return isDark ? color.dark : color.light;
};

export const getNoteTextColor = (colorId, isDark) => {
    const color = NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
    return isDark ? color.darkLabel : color.lightLabel;
};
