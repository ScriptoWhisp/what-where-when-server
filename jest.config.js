/** @type {import('jest').Config} */
module.exports = {
  // Makes IDE "Run" use the same setup as CLI.
  // Individual scripts still point at the specific project configs.
  projects: ['<rootDir>/jest.unit.config.js', '<rootDir>/jest.e2e.config.js'],
};
