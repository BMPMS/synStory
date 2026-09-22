import { mount } from 'svelte'
import './global.css'
import { applyThemeVars } from './lib/theme.js'
import App from './App.svelte'

applyThemeVars()

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
