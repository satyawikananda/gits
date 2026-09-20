<script setup lang="ts">
import type { SearchConfig, Settings } from '../../shared/types'
import { defaultConfig } from '../../shared/search'

const props = defineProps<{ settings: Settings, busy: boolean }>()
const emit = defineEmits<{ start: [config: SearchConfig] }>()
const form = reactive(structuredClone(defaultConfig))
const keywords = ref('')
const ratingFilter = ref(false)
const minimumRating = ref(4)

function submit() {
  emit('start', {
    ...form,
    keywords: keywords.value
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    filters: {
      ...form.filters,
      minimumRating: ratingFilter.value ? minimumRating.value : undefined,
    },
    engine: props.settings.engine,
    decisionLimit: props.settings.decisionLimit,
  })
}
</script>

<template>
  <form class="flex flex-col gap-18px" @submit.prevent="submit">
    <label class="flex flex-col gap-8px text-13px">
      What are you looking for?
      <input
        v-model="form.niche"
        class="gits-input"
        required
        maxlength="120"
        placeholder="Coffee shop"
        autocomplete="off"
      >
    </label>
    <label class="flex flex-col gap-8px text-13px">
      Location
      <input
        v-model="form.location"
        class="gits-input"
        required maxlength="180"
        placeholder="Denpasar, Bali"
        autocomplete="off"
      >
    </label>
    <label class="flex flex-col gap-8px text-13px">
      Keywords
      <input
        v-model="keywords"
        class="gits-input"
        maxlength="640"
        placeholder="cafe, specialty coffee"
        aria-describedby="keyword-hint"
      >
      <span id="keyword-hint" class="gits-muted text-12px">
        Optional - separate with commas (up to 8)
      </span>
    </label>
    <fieldset class="m-0 min-w-0 flex flex-col gap-8px border-0 p-0">
      <legend class="mb-8px text-13px">
        Filters
      </legend>
      <label class="min-h-24px flex items-center gap-8px">
        <input
          v-model="form.filters.withoutWebsite"
          class="gits-focus h-18px w-18px shrink-0 accent-primary" type="checkbox"
        >
        Without website
      </label>
      <label class="min-h-24px flex items-center gap-8px">
        <input
          v-model="form.filters.activeBusiness"
          class="gits-focus h-18px w-18px shrink-0 accent-primary"
          type="checkbox"
        >
        Active business
      </label>
      <label class="min-h-24px flex items-center gap-8px">
        <input
          v-model="ratingFilter"
          class="gits-focus h-18px w-18px shrink-0 accent-primary"
          type="checkbox"
        >
        Minimum rating
      </label>
      <input
        v-if="ratingFilter"
        v-model.number="minimumRating"
        class="gits-input"
        type="number"
        min="0"
        max="5"
        step="0.1"
        aria-label="Minimum rating"
        required
      >
    </fieldset>
    <label class="flex flex-col gap-8px text-13px">
      Target
      <input
        v-model.number="form.targetLeadCount"
        class="gits-input"
        type="number"
        min="1"
        max="500"
        required
        aria-describedby="target-hint"
      >
      <span
        id="target-hint"
        class="gits-muted text-12px"
      >
        Qualified leads - {{ settings.decisionLimit }} decision call limit
      </span>
    </label>

    <p v-if="settings.engine === 'mock'" class="gits-notice">
      Mock mode · no Jev calls. Business data still comes from Google Maps.
    </p>

    <button class="gits-button min-h-48px bg-primary text-black font-semibold" type="submit" :disabled="busy">
      {{ busy ? "Starting…" : "Start Research" }}
      <span aria-hidden="true" />
    </button>
  </form>
</template>
