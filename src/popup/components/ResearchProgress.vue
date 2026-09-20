<script setup lang="ts">
import { computed } from 'vue'
import type { SearchSession } from '../../shared/types'

const props = defineProps<{ session: SearchSession, busy: boolean }>()
defineEmits<{ pause: [], resume: [], stop: [], review: [] }>()
const decision = computed(
  () =>
    props.session.leads.find(lead => lead.id === props.session.current?.id)
      ?.decision,
)
</script>

<template>
  <section class="flex flex-col gap-18px">
    <div>
      <h2 class="text-15px font-semibold [overflow-wrap:anywhere]">
        {{ session.niche }} <span class="gits-muted text-13px">·</span> {{ session.location }}
      </h2>
      <p class="gits-muted text-12px">
        {{
          session.status === "running"
            ? "Finding qualified leads…"
            : `Research ${session.status}`
        }}
      </p>
    </div>
    <div
      v-if="session.errorCode || session.status === 'error'"
      class="gits-panel flex flex-col gap-8px border-l-3 border-critical rounded-r-10px p-12px text-13px [overflow-wrap:anywhere]"
      role="alert"
    >
      <strong>Research needs attention</strong>
      <p>{{ session.message }}</p>
      <details class="text-12px">
        <summary class="gits-focus cursor-pointer">
          Error details
        </summary>
        <p class="mt-4px font-mono">
          Code: {{ session.errorCode || 'unexpected' }}
        </p>
        <p class="font-mono">
          Step: {{ session.phase }}
        </p>
      </details>
    </div>
    <div class="flex items-center gap-14px">
      <progress
        class="h-7px min-w-0 w-full appearance-none overflow-hidden border-0 rounded-8px bg-input dark:bg-input-dark [&::-webkit-progress-bar]:bg-input dark:[&::-webkit-progress-bar]:bg-input-dark [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
        :value="session.qualifiedCount"
        :max="session.targetLeadCount"
        aria-label="Qualified leads"
      /><span class="shrink-0 whitespace-nowrap font-mono text-12px">{{ session.qualifiedCount }} / {{ session.targetLeadCount }}</span>
    </div>
    <section v-if="session.current" class="flex flex-col gap-8px">
      <h3 class="gits-muted text-12px font-medium">
        Current business
      </h3>
      <div class="gits-panel rounded-12px p-14px [overflow-wrap:anywhere] flex flex-col gap-8px">
        <h2 class="text-18px font-semibold">
          {{ session.current.name }}
        </h2>
        <p class="gits-muted text-13px">
          {{ session.current.category || "Category unavailable" }}
        </p>
        <p class="gits-muted text-12px">
          {{ session.current.rating ?? "—" }} rating ·
          {{ session.current.reviewCount ?? "—" }} reviews
        </p>
        <p class="gits-muted text-12px">
          Website:
          {{
            session.current.website
              ? "Listed"
              : session.current.website === null
                ? "Not found"
                : "Unknown"
          }}
        </p>
        <template v-if="decision">
          <span class="gits-muted text-12px">{{ session.engine === "mock" ? "Mock" : "Jev" }} decision</span>
          <div class="flex items-center justify-between gap-10px">
            <strong>Qualified</strong><span v-if="decision.confidence !== undefined" class="gits-muted text-12px">{{ Math.round(decision.confidence * 100) }}%</span>
          </div>
          <div class="flex items-center justify-between gap-10px gits-muted text-12px">
            <span>Priority</span><strong class="shrink-0 text-12px capitalize">{{ decision.priority }}</strong>
          </div>
          <p class="gits-muted text-12px">
            {{ decision.reason }}
          </p>
        </template>
      </div>
    </section>
    <section class="flex flex-col gap-8px">
      <h3 class="gits-muted text-12px font-medium">
        Search activity
      </h3>
      <ul class="m-0 flex list-none flex-col gap-10px p-0">
        <li
          v-for="(item, i) in session.activity.slice(0, 4)"
          :key="`${i}-${item.name}`"
          class="flex flex-col gap-2px text-13px [overflow-wrap:anywhere]"
        >
          <strong class="font-medium">{{ item.name }}</strong><span class="gits-muted text-12px">{{ item.reason }}</span>
        </li>
      </ul>
      <p v-if="!session.errorCode && session.status !== 'error'" class="gits-muted text-12px" role="status">
        {{ session.message }}
      </p>
    </section>
    <div class="gits-muted text-12px font-mono text-12px">
      <p>{{ session.analyzedCount }} businesses analyzed</p>
      <p>{{ session.qualifiedCount }} qualified</p>
      <p>
        {{ session.jevDecisionCount }} / {{ session.decisionLimit }} Jev
        calls<span v-if="session.engine === 'mock'">
          · {{ session.mockDecisionCount }} mock decisions</span>
      </p>
    </div>
    <div class="flex items-center justify-between gap-10px [&>button]:flex-1">
      <button
        v-if="session.status === 'running'"
        class="gits-button gits-panel"
        :disabled="busy"
        @click="$emit('pause')"
      >
        Ⅱ Pause
      </button><button v-else class="gits-button min-h-48px bg-primary text-black font-semibold" :disabled="busy" @click="$emit('resume')">
        Resume
      </button><button class="gits-button bg-warning text-black" :disabled="busy" @click="$emit('stop')">
        □ Stop
      </button>
    </div>
    <button
      v-if="session.leads.length"
      class="gits-button bg-transparent px-4px py-6px"
      @click="$emit('review')"
    >
      Review {{ session.leads.length }} saved leads
    </button>
  </section>
</template>
