import { fileURLToPath } from 'node:url'
import lucide from '@iconify/json/json/lucide.json'
import { defineConfig } from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'

export default defineConfig({
  content: {
    filesystem: [fileURLToPath(new URL('./src/**/index.html', import.meta.url))],
  },
  theme: {
    fontFamily: {
      sans: 'Arial, Helvetica, sans-serif',
    },
    colors: {
      primary: '#51f0a8',
      canvas: { DEFAULT: '#fdfdfd', dark: '#000000' },
      ink: { DEFAULT: '#000000', dark: '#f0f0f0' },
      muted: { DEFAULT: '#f5f5f5', dark: '#252527' },
      subtle: { DEFAULT: '#525252', dark: '#969696' },
      input: { DEFAULT: '#ebebeb', dark: '#3b3b3b' },
      line: { DEFAULT: '#f4f6f8', dark: '#19191a' },
      accent: { DEFAULT: '#f9fffc', dark: '#093723' },
      warning: '#ffb188',
      critical: '#ff4838',
      destructive: { DEFAULT: '#f54a88', dark: '#ff78a5' },
    },
  },
  shortcuts: {
    'gits-page': 'm-0 bg-canvas text-ink font-sans text-14px leading-normal dark:bg-canvas-dark dark:text-ink-dark',
    'gits-muted': 'text-subtle dark:text-subtle-dark',
    'gits-focus': 'focus-visible:outline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-3 focus-visible:ring-1 focus-visible:ring-ink dark:focus-visible:ring-ink-dark',
    'gits-button': 'gits-focus min-h-38px border border-transparent rounded-10px px-14px py-10px text-14px leading-normal cursor-pointer enabled:hover:brightness-94 enabled:active:translate-y-1px disabled:opacity-55 disabled:cursor-not-allowed',
    'gits-input': 'gits-focus min-w-0 w-full min-h-42px border border-transparent rounded-10px bg-input px-13px py-11px text-13px text-ink leading-normal dark:bg-input-dark dark:text-ink-dark placeholder:text-subtle placeholder:opacity-100 dark:placeholder:text-subtle-dark',
    'gits-panel': 'bg-muted dark:bg-muted-dark',
    'gits-border': 'border-line dark:border-line-dark',
    'gits-notice': 'gits-border border rounded-10px bg-accent px-14px py-12px text-12px dark:bg-accent-dark',
    'btn': 'inline-block cursor-pointer rounded bg-teal-600 px-4 py-1 text-white hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
    'icon-btn': 'inline-block cursor-pointer select-none text-[0.9em] opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600',
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({ collections: { lucide: () => lucide } }),
  ],
  transformers: [
    transformerDirectives(),
  ],
})
