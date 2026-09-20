<script setup lang="ts">
import type { Command, Connection, Settings } from '../../shared/types'

const props = defineProps<{
  settings: Settings
  connection: Connection
  busy: boolean
  running: boolean
}>()

const emit = defineEmits<{ command: [command: Command], done: [] }>()

const key = ref('')
const visible = ref(false)
const settings = ref({ ...props.settings })

function connect() {
  const entered = key.value
  key.value = ''
  emit('command', { type: 'connect', key: entered || undefined })
}
</script>

<template>
  <section class="flex flex-col gap-18px">
    <div>
      <h2 class="text-18px font-semibold">
        {{ connection.connected ? "Jev connected" : "Connect Jev" }}
      </h2>
      <p class="gits-muted text-13px">
        Gits uses Jev to decide which businesses are worth turning into leads.
      </p>
    </div>
    <form class="flex flex-col gap-18px" @submit.prevent="connect">
      <label class="flex flex-col gap-8px text-13px">
        {{ connection.hasKey
          ? "Replace your Jev API key"
          : "Your Jev API Key"
        }}
        <span class="flex items-center rounded-10px bg-input dark:bg-input-dark">
          <input
            v-model="key"
            class="gits-input"
            :type="visible ? 'text' : 'password'"
            :required="!connection.hasKey"
            maxlength="512"
            autocomplete="off"
            spellcheck="false"
            :placeholder="connection.hasKey ? 'Key saved locally' : 'Enter your Jev API key'"
            :disabled="running"
          >
          <button
            class="gits-button shrink-0 bg-transparent p-8px text-12px"
            type="button"
            :aria-label="visible ? 'Hide API key' : 'Show API key'"
            @click="visible = !visible"
          >
            {{ visible ? "Hide" : "Show" }}
          </button>
        </span>
      </label>
      <div class="gits-notice">
        <strong>Stored locally in your browser.</strong>
        <p>
          Your key goes directly to Jev for requests. Browser storage is not an
          encrypted secret vault.
        </p>
      </div>
      <p class="gits-muted text-12px">
        Connection tests make one Jev request outside research budgets.
      </p>
      <button class="gits-button min-h-48px bg-primary text-black font-semibold" :disabled="busy || running">
        {{
          busy
            ? "Testing connection…"
            : key
              ? "Connect & Continue"
              : connection.hasKey
                ? "Test Connection"
                : "Connect & Continue"
        }}
      </button>
    </form>
    <div v-if="connection.hasKey" class="flex items-center justify-between gap-10px">
      <span
        class="whitespace-nowrap rounded-full bg-muted px-9px py-3px text-11px dark:bg-muted-dark"
        :class="{ '!bg-primary !text-black': connection.connected }"
      >
        {{ connection.connected ? "Connected" : "Not verified" }}
      </span>
      <button
        class="gits-button bg-transparent px-4px py-6px underline decoration-destructive decoration-2 dark:decoration-destructive-dark"
        :disabled="busy"
        @click="emit('command', { type: 'remove-key' })"
      >
        Remove key
      </button>
    </div>
    <p v-if="running" class="gits-muted text-12px">
      Pause research before testing or replacing your key.
    </p>
    <p class="text-center gits-muted text-12px">
      Don't have a Jev API key?
      <br>
      <a
        class="gits-focus underline underline-offset-3"
        href="https://typesafe.ai"
        target="_blank"
        rel="noopener noreferrer"
      >
        Get one from TypeSafe
      </a>
    </p>
    <form
      class="flex flex-col gap-18px gits-border border-t pt-18px"
      @submit.prevent="emit('command', { type: 'settings', settings: { ...settings } })"
    >
      <label class="flex flex-col gap-8px text-13px">
        Per-session decision limit
        <input
          v-model.number="settings.decisionLimit"
          class="gits-input"
          type="number"
          min="1"
          max="1000"
          required
        >
      </label>
      <label class="flex flex-col gap-8px text-13px">
        Appearance
        <select v-model="settings.theme" class="gits-input">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <p class="gits-muted text-12px">
        Engine and budget changes apply to the next search.
      </p>
      <button class="gits-button gits-panel" :disabled="busy">
        Save settings
      </button>
    </form>
    <button class="gits-button bg-transparent px-4px py-6px" @click="emit('done')">
      Back to research
    </button>
  </section>
</template>
