module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'instrument-serif': ['"Instrument Serif"', 'serif'],
      },
      backgroundColor: {
        'custom-bg': '#f5e6d3',
      },
    },
  },
  plugins: [],
}