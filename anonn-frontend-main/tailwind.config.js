export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        grotesk: ['"Overused Grotesk"', 'sans-serif'],
        spacemono: ['"Space Mono"', 'monospace'],
      },
      fontSize: {
        // Base font size increased from default 16px to 18px for better readability
        'xs': ['0.875rem', { lineHeight: '1.25rem' }],      // 14px - labels, captions
        'sm': ['1rem', { lineHeight: '1.5rem' }],            // 16px - small text, buttons
        'base': ['1.125rem', { lineHeight: '1.75rem' }],    // 18px - body text (default)
        'lg': ['1.25rem', { lineHeight: '1.75rem' }],        // 20px - emphasized text
        'xl': ['1.5rem', { lineHeight: '2rem' }],            // 24px - subheadings
        '2xl': ['1.875rem', { lineHeight: '2.25rem' }],      // 30px - headings
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],        // 36px - large headings
        '4xl': ['3rem', { lineHeight: '1' }],                // 48px - hero text
      },
    },
  },
  plugins: [],
};
