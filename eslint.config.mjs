import antfu from '@antfu/eslint-config'

export default antfu({
  // Installed agent references contain illustrative and intentionally invalid code.
  ignores: ['.agents/**', '.claude/**'],
})
