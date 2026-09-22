import nextConfig from 'eslint-config-next/core-web-vitals'

export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', '.kilo/**'],
  },
  {
    rules: {
      // These React Compiler diagnostics are not part of the previous
      // Next.js/ESLint baseline used by this application.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
]
