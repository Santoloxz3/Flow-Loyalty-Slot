// postcss.config.js (versione CommonJS)
const tailwindcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

module.exports = {
  plugins: [tailwindcss(), autoprefixer()],
};
