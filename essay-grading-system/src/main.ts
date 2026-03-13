import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

console.log('Starting app initialization...')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

console.log('Pinia and router initialized')

// Mount immediately without auth initialization
console.log('Mounting app...')
app.mount('#app')
console.log('App mounted!')
