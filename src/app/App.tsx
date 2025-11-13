import { effect } from 'mutts/src'
import { stored } from 'pounce-ui/src'

const theme = stored({
	mode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
})

effect(() => {
	document.documentElement.dataset.theme = theme.mode
})

const App = () => (
	<div class="app-shell">
		<header class="app-shell__header">
			<div>
				<h1>SSH Pounce Shell</h1>
				<p>Bootstrap scaffolding is ready. UI migration work continues.</p>
			</div>
			<label class="theme-toggle">
				<input
					type="checkbox"
					checked={theme.mode === 'dark'}
					update:checked={(dark) => {
						theme.mode = dark ? 'dark' : 'light'
					}}
				/>
				<span>Dark mode</span>
			</label>
		</header>
		<main class="app-shell__body">
			<p>
				This placeholder view renders through Pounce. Replace it with gameplay HUD and widgets as
				they are ported.
			</p>
		</main>
	</div>
)

export default App


