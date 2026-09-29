import { mount } from 'svelte'
import './global.css'
import { applyThemeVars } from './lib/theme.js'
import TestApp from './TestApp.svelte'

applyThemeVars()

const app = mount(TestApp, {
  target: document.getElementById('test-app'),
})

export default app
