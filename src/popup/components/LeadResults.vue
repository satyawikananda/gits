<script setup lang="ts">
import type { SearchSession } from '../../shared/types'

const props = defineProps<{ session: SearchSession, busy: boolean }>()
defineEmits<{ export: [], newSearch: [], back: [] }>()
const all = ref(false)
const confirmNew = ref(false)
const order = { high: 0, medium: 1, low: 2 }
const sorted = computed(() =>
  [...props.session.leads].sort(
    (a, b) => order[a.decision.priority] - order[b.decision.priority],
  ),
)

const visible = computed(() =>
  all.value ? sorted.value : sorted.value.slice(0, 3),
)

const counts = computed(() =>
  ['high', 'medium', 'low'].map(priority => ({
    priority,
    count: props.session.leads.filter(l => l.decision.priority === priority)
      .length,
  })),
)
</script>

<template>
  <section class="flex flex-col gap-18px">
    <div>
      <h2 class="text-18px font-semibold">
        {{
          session.status === "completed"
            ? "Search complete"
            : `Research ${session.status}`
        }}
      </h2>
      <p class="gits-muted text-12px">
        {{ session.qualifiedCount }} qualified leads · found from
        {{ session.analyzedCount }} businesses
      </p>
      <p class="gits-muted text-12px" role="status">
        {{ session.message }}
      </p>
    </div>
    <p v-if="session.engine === 'mock'" class="gits-notice">
      Mock decisions · these qualifications have not been assessed by Jev.
    </p>
    <div class="grid grid-cols-3 gap-10px">
      <div
        v-for="item in counts"
        :key="item.priority"
        class="flex flex-col gap-2px rounded-10px p-12px text-center"
        :class="item.priority === 'high' ? 'bg-primary text-black' : 'gits-panel'"
      >
        <strong class="font-mono text-20px">
          {{ item.count }}
        </strong>
        <span class="text-11px capitalize">
          {{ item.priority }}
        </span>
      </div>
    </div>
    <section class="flex flex-col gap-8px">
      <h3 class="text-13px font-medium">
        {{ all ? "All leads" : "Top leads" }}
      </h3>
      <p v-if="!visible.length" class="gits-muted text-13px">
        No qualified leads saved yet.
      </p>
      <article
        v-for="lead in visible"
        :key="lead.id"
        class="gits-border border-b py-10px [overflow-wrap:anywhere]"
      >
        <div class="flex items-start justify-between gap-10px">
          <a
            class="gits-focus min-w-0 underline-offset-3 hover:underline"
            :href="lead.mapsUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <strong>{{ lead.name }}</strong>
          </a>
          <span class="shrink-0 text-12px capitalize">
            {{ lead.decision.priority }}
          </span>
        </div>
        <p class="gits-muted text-12px">
          {{ lead.rating ?? "—" }} rating ·
          {{ lead.reviewCount ?? "—" }} reviews ·
          {{ lead.website ? "Website listed" : "No website listed" }}
        </p>
        <details class="mt-4px">
          <summary class="gits-focus gits-muted cursor-pointer py-4px text-12px">
            {{ lead.category || "Business details" }}
          </summary>
          <p class="gits-muted text-12px">
            {{ lead.address || lead.location || "Address unavailable" }}
          </p>
          <p v-if="lead.phone" class="gits-muted text-12px">
            {{ lead.phone }}
          </p>
          <p class="gits-muted text-12px">
            {{ session.engine === "mock" ? "Mock" : "Jev" }} decision:
            {{ lead.decision.reason }}
          </p>
          <p v-if="lead.decision.confidence !== undefined" class="gits-muted text-12px">
            Qualification probability:
            {{ Math.round(lead.decision.confidence * 100) }}%
          </p>
        </details>
      </article>
    </section>
    <button
      v-if="!all && session.leads.length > 3"
      class="gits-button min-h-48px bg-primary text-black font-semibold"
      @click="all = true"
    >
      View All Leads
    </button>
    <div class="flex items-center justify-between gap-10px [&>button]:flex-1">
      <button
        class="gits-button gits-panel"
        :disabled="!session.leads.length"
        @click="$emit('export')"
      >
        Export CSV
      </button>
      <button
        v-if="session.status !== 'running'"
        class="gits-button gits-panel"
        :disabled="busy"
        @click="confirmNew = true"
      >
        New Search
      </button>
    </div>
    <div v-if="confirmNew" class="gits-notice flex flex-col gap-8px">
      <p>
        Starting a new search replaces these local results. Export anything you
        want to keep first.
      </p>
      <div class="flex items-center justify-between gap-10px">
        <button class="gits-button gits-panel" @click="confirmNew = false">
          Cancel
        </button>
        <button
          class="gits-button min-h-48px bg-primary text-black font-semibold" :disabled="busy" @click="$emit('newSearch')"
        >
          Start new search
        </button>
      </div>
    </div>
    <button
      v-if="['running', 'paused', 'error'].includes(session.status)"
      class="gits-button bg-transparent px-4px py-6px"
      @click="$emit('back')"
    >
      Back to research
    </button>
  </section>
</template>
