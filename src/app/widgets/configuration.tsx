import { configuration } from '$lib/globals'
import { type DockviewWidgetProps, Inline, Radio } from 'pounce-ui/src'

const timeOptions = [
	{ value: 'pause', label: 'Pause' },
	{ value: 'play', label: 'Play' },
	{ value: 'fast-forward', label: 'Fast forward' },
	{ value: 'gonzales', label: 'Gonzales' },
] as const

const ConfigurationWidget = (props: DockviewWidgetProps) => {
	props.title = 'Configuration'

	return (
		<div class="configuration-widget">
			<label class="configuration-widget__toggle">
				<input
					type="checkbox"
					checked={configuration.darkMode}
					update:checked={(value: boolean) => {
						configuration.darkMode = value
					}}
				/>
				<span>Dark mode</span>
			</label>
			<fieldset class="configuration-widget__fieldset">
				<legend>Time control</legend>
				<Inline gap="sm" class="configuration-widget__radios">
					{timeOptions.map((option) => (
						<Radio
							name={`time-control-${props.api?.id ?? 'panel'}`}
							value={option.value}
							checked={configuration.timeControl === option.value}
							onChange={() => {
								configuration.timeControl = option.value
							}}
						>
							{option.label}
						</Radio>
					))}
				</Inline>
			</fieldset>
		</div>
	)
}

export default ConfigurationWidget
