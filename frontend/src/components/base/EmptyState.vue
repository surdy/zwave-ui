<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
  }>(),
  {},
)
</script>

<template>
  <div class="empty">
    <div v-if="icon || $slots.icon" class="empty__icon" aria-hidden="true">
      <slot name="icon">{{ icon }}</slot>
    </div>
    <h3 v-if="title || $slots.title" class="empty__title">
      <slot name="title">{{ title }}</slot>
    </h3>
    <p v-if="description || $slots.description" class="empty__desc">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--s-2);
  padding: var(--s-7) var(--s-5);
  color: var(--color-text-muted);
}
.empty__icon {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: var(--s-2);
}
.empty__title {
  margin: 0;
  color: var(--color-text);
  font-size: 1.0625rem;
}
.empty__desc {
  margin: 0;
  max-width: 36ch;
}
.empty__action {
  margin-top: var(--s-3);
}
</style>
