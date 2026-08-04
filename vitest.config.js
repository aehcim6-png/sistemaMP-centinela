module.exports = {
  test: {
    globals: true,
    environment: 'node',
    // Sin esto, Vitest también recoge *.test.mjs de skills locales instaladas
    // bajo .claude/ (herramientas de autoría de video, no parte de la app).
    include: ['tests/**/*.test.js']
  }
};
