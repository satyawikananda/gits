<script setup lang="ts">
import type { Command, SearchConfig } from '../../shared/types'
import logo from '../../assets/gits-logo.png'
import { useResearch } from '../composables/useResearch'
import SearchForm from './SearchForm.vue'
import JevSettings from './JevSettings.vue'
import ResearchProgress from './ResearchProgress.vue'
import LeadResults from './LeadResults.vue'

const props = defineProps<{ initialView?: 'settings' }>()
const { data, session, busy, ready, error, request, exportCsv } = useResearch()
const view = ref<'research' | 'settings' | 'results'>(
  props.initialView ?? 'research',
)
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
const dark = computed(
  () =>
    data.value.settings.theme === 'dark'
    || (data.value.settings.theme === 'system' && systemDark.value),
)
const running = computed(() => session.value?.status === 'running')
const showSettings = computed(
  () =>
    view.value === 'settings'
    || (ready.value
      && !session.value
      && !data.value.connection.connected
      && data.value.settings.engine === 'jev'),
)
const showResults = computed(
  () =>
    view.value === 'results'
    || ['completed', 'stopped'].includes(session.value?.status ?? ''),
)
function themeListener(event: MediaQueryListEvent) {
  systemDark.value = event.matches
}
onMounted(() => media.addEventListener('change', themeListener))
onUnmounted(() => media.removeEventListener('change', themeListener))
watch(
  dark,
  value => document.documentElement.classList.toggle('dark', value),
  { immediate: true },
)

async function command(value: Command) {
  const success = await request(value)
  if (success && ['connect', 'settings', 'new-search'].includes(value.type))
    view.value = 'research'
}
async function start(config: SearchConfig) {
  await command({ type: 'start', config })
}
</script>

<template>
  <main class="mx-auto min-h-540px w-full max-w-420px px-22px py-24px text-14px leading-normal">
    <header class="gits-border mb-18px flex items-center justify-between gap-16px border-b pb-18px">
      <div class="min-w-0">
        <div class="flex items-start gap-1.5">
          <img class="mb-8px h-32px w-32px object-contain" :src="logo" alt="gits-logo" width="32" height="32">
          <h1 class="text-24px font-bold ">
            Gits
          </h1>
        </div>
        <p class="gits-muted text-12px">
          Get Into The Search
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-10px">
        <span
          v-if="running"
          class="whitespace-nowrap rounded-full bg-muted px-9px py-3px text-11px dark:bg-muted-dark !bg-primary !text-black"
        >●
          Live</span><button
          class="gits-button grid w-38px shrink-0 place-items-center bg-transparent p-8px text-18px"
          :aria-label="showSettings ? 'Back to research' : 'Settings'" :aria-pressed="showSettings"
          @click="view = showSettings ? 'research' : 'settings'"
        >
          <span class="i-lucide-settings" aria-hidden="true" />
        </button>
      </div>
    </header>
    <p v-if="!ready" class="gits-muted text-13px" role="status">
      Loading your research…
    </p>
    <p
      v-if="error" class="gits-panel mb-18px border-l-3 border-critical p-12px text-13px [overflow-wrap:anywhere]"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="ready">
      <JevSettings
        v-if="showSettings"
        :key="`${data.settings.engine}-${data.settings.theme}-${data.settings.decisionLimit}`"
        :settings="data.settings"
        :connection="data.connection"
        :busy="busy"
        :running="running"
        @command="command"
        @done="view = 'research'"
      />
      <LeadResults
        v-else-if="session && showResults"
        :session="session"
        :busy="busy"
        @export="exportCsv"
        @new-search="command({ type: 'new-search' })"
        @back="view = 'research'"
      />
      <ResearchProgress
        v-else-if="session"
        :session="session"
        :busy="busy"
        @pause="command({ type: 'pause' })"
        @resume="command({ type: 'resume' })"
        @stop="command({ type: 'stop' })"
        @review="view = 'results'"
      />
      <SearchForm
        v-else
        :settings="data.settings"
        :busy="busy"
        @start="start"
      />
    </template>
  </main>
</template>
