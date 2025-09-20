import { computed } from "mutts"
import type { ExecutionContext } from "npc-script/src"
import { type TickedGameObject, withTicked, GameObject } from "../object"
import { ScriptExecution } from "./scripts"
import { ASingleStep } from "./steps"
import type { Game } from "../game"

export function withScripted<T extends new (...args: any[]) => TickedGameObject>(Base: T) {
	abstract class ScriptedMixin extends Base {
		constructor(...args: any[]) {
			super(...args)
			const game = args[0] as Game
			game.on('gameStart', () => {
				if (this.stepExecutor) return
				const firstAction = this.findAction()
				if (firstAction) this.begin(firstAction)
			})
		}
		public stepExecutor: ASingleStep | undefined
		public runningScripts: ScriptExecution[] = []
		get runningScript() {
			return this.runningScripts[0]
		}
		abstract scriptsContext: ExecutionContext
		abstract findAction(): ScriptExecution | undefined

		@computed
		get actionDescription(): string[] {
			return this.runningScripts.map((s) => s.name).reverse()
		}
		nextStep() {
			if (this.stepExecutor) throw new Error('Cannot begin a new script while another is running')
			if (!this.runningScripts.length) {
				const nextAction = this.findAction()
				if (nextAction) this.runningScripts.unshift(nextAction)
			}
			let reentered = false
			while (this.runningScripts.length && !this.stepExecutor) {
				const executingName = this.runningScripts[0].name
				const { type, value } = this.runningScripts[0].run(this.scriptsContext)
				if (type === 'return') this.runningScripts.shift()
				if (value) {
					reentered = false
					if (value instanceof ScriptExecution) this.runningScripts.unshift(value)
					else if (value instanceof ASingleStep) this.stepExecutor = value
					else throw new Error(`Unexpected next action: ${value}`)
				} else if (!this.runningScripts.length) {
					const nextAction = this.findAction()
					if (nextAction?.name === executingName) {
						if (reentered) throw new Error(`Action infinite fail/foundAction: ${executingName}`)
						reentered = true
					}
					if (nextAction) this.runningScripts.unshift(nextAction)
				}
			}
		}

		update(dt: number) {
			let remaining: number | undefined = dt * 5
			let uselessStepExecutor: string | false = false
			while (remaining !== undefined && this.stepExecutor) {
				const newRemaining = this.stepExecutor.tick(remaining)
				if (newRemaining === remaining && this.stepExecutor)
					uselessStepExecutor = this.stepExecutor.type
				remaining = newRemaining
				if (remaining !== undefined) {
					this.stepExecutor = undefined
					this.nextStep()
					const newType = this.stepExecutor!?.type
					if (uselessStepExecutor === newType) throw new Error(`Useless step executor: ${newType}`)
				}
			}
		}
		begin(exec: ScriptExecution) {
			if (this.stepExecutor) throw new Error('Cannot begin a new script while another is running')
			this.runningScripts.unshift(exec)
			this.nextStep()
		}
		abandonAnd(exec: ScriptExecution) {
			if (this.stepExecutor) this.stepExecutor.cancel()
			for (const script of this.runningScripts) script.cancel()
			this.runningScripts.splice(0, this.runningScripts.length)
			this.stepExecutor = undefined
			this.begin(exec)
		}
	}
	return ScriptedMixin
}

export type ScriptedObject = InstanceType<
	ReturnType<typeof withScripted<ReturnType<typeof withTicked<typeof GameObject>>>>
>
