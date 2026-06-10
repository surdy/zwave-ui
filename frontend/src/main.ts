import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './styles/tokens.css'
import './styles/base.css'

import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Apply the persisted theme before mount to avoid a flash of the wrong theme.
useUiStore().applyTheme()

app.mount('#app')
