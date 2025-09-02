import { describe, expect, it } from "vitest"
import { effect, isReactive, Reactive, reactive, unwrap } from "./reactive"

describe("reactive", () => {
	describe("basic functionality", () => {
		it("should make objects reactive", () => {
			const obj = { count: 0, name: "test" }
			const reactiveObj = reactive(obj)

			expect(isReactive(reactiveObj)).toBe(true)
			expect(isReactive(obj)).toBe(false)
			expect(reactiveObj.count).toBe(0)
			expect(reactiveObj.name).toBe("test")
		})

		it("should not make primitives reactive", () => {
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(42)).toBe(42)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive("string")).toBe("string")
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(true)).toBe(true)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(null)).toBe(null)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(undefined)).toBe(undefined)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(true)).toBe(true)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(null)).toBe(null)
			//@ts-expect-error - we want to test the behavior of reactive with primitives
			expect(reactive(undefined)).toBe(undefined)
		})

		it("should not make arrays reactive", () => {
			const arr = [1, 2, 3]
			expect(reactive(arr)).toBe(arr)
		})

		it("should return same proxy for same object", () => {
			const obj = { count: 0 }
			const proxy1 = reactive(obj)
			const proxy2 = reactive(obj)

			expect(proxy1).toBe(proxy2)
		})

		it("should return same proxy when called on proxy", () => {
			const obj = { count: 0 }
			const proxy1 = reactive(obj)
			const proxy2 = reactive(proxy1)

			expect(proxy1).toBe(proxy2)
		})
	})

	describe("property access and modification", () => {
		it("should allow reading properties", () => {
			const obj = { count: 0, name: "test" }
			const reactiveObj = reactive(obj)

			expect(reactiveObj.count).toBe(0)
			expect(reactiveObj.name).toBe("test")
		})

		it("should allow setting properties", () => {
			const obj = { count: 0 }
			const reactiveObj = reactive(obj)

			reactiveObj.count = 5
			expect(reactiveObj.count).toBe(5)
			expect(obj.count).toBe(5)
		})

		it("should handle numeric properties", () => {
			const obj = { 0: "zero", 1: "one" }
			const reactiveObj = reactive(obj)

			expect(reactiveObj[0]).toBe("zero")
			expect(reactiveObj[1]).toBe("one")

			reactiveObj[0] = "ZERO"
			expect(reactiveObj[0]).toBe("ZERO")
		})

		it("should handle symbol properties", () => {
			const sym = Symbol("test")
			const obj = { [sym]: "value" }
			const reactiveObj = reactive(obj)

			expect(reactiveObj[sym]).toBe("value")

			reactiveObj[sym] = "new value"
			expect(reactiveObj[sym]).toBe("new value")
		})
	})

	describe("unwrap functionality", () => {
		it("should unwrap reactive objects", () => {
			const obj = { count: 0 }
			const reactiveObj = reactive(obj)

			const unwrapped = unwrap(reactiveObj)
			expect(unwrapped).toBe(obj)
			expect(unwrapped).not.toBe(reactiveObj)
		})

		it("should return non-reactive objects as-is", () => {
			const obj = { count: 0 }
			expect(unwrap(obj)).toBe(obj)
		})
	})
})

describe("effect", () => {
	describe("basic effect functionality", () => {
		it("should run effect immediately", () => {
			let count = 0
			const reactiveObj = reactive({ value: 0 })

			effect(() => {
				count++
				reactiveObj.value
			})

			expect(count).toBe(1)
		})

		it("should track dependencies", () => {
			let effectCount = 0
			const reactiveObj = reactive({ count: 0 })

			effect(() => {
				effectCount++
				reactiveObj.count
			})

			expect(effectCount).toBe(1)

			reactiveObj.count = 5
			expect(effectCount).toBe(2)
		})

		it("should only track accessed properties", () => {
			let effectCount = 0
			const reactiveObj = reactive({ count: 0, name: "test" })

			effect(() => {
				effectCount++
				reactiveObj.count // Only access count
			})

			expect(effectCount).toBe(1)

			reactiveObj.name = "new name" // Change name
			expect(effectCount).toBe(1) // Should not trigger effect

			reactiveObj.count = 5 // Change count
			expect(effectCount).toBe(2) // Should trigger effect
		})
	})

	describe("cascading effects", () => {
		it("should properly handle cascading effects", () => {
			const reactiveObj = reactive({ a: 0, b: 0, c: 0 })

			effect(() => {
				reactiveObj.b = reactiveObj.a + 1
			})
			effect(() => {
				reactiveObj.c = reactiveObj.b + 1
			})

			expect(reactiveObj.a).toBe(0)
			expect(reactiveObj.b).toBe(1)
			expect(reactiveObj.c).toBe(2)

			reactiveObj.b = 5
			expect(reactiveObj.a).toBe(0)
			expect(reactiveObj.b).toBe(5)
			expect(reactiveObj.c).toBe(6)

			reactiveObj.a = 3
			expect(reactiveObj.a).toBe(3)
			expect(reactiveObj.b).toBe(4)
			expect(reactiveObj.c).toBe(5)
		})

		it("should prevent nested effects", () => {
			const reactiveObj = reactive({ count: 0 })

			expect(() => {
				effect(() => {
					reactiveObj.count
					effect(() => {
						reactiveObj.count
					})
				})
			}).toThrow("Nested effects are not allowed")
		})
	})

	describe("effect cleanup", () => {
		it("should return unwatch function", () => {
			const reactiveObj = reactive({ count: 0 })
			let effectCount = 0

			const unwatch = effect(() => {
				effectCount++
				reactiveObj.count
			})

			expect(typeof unwatch).toBe("function")
			expect(effectCount).toBe(1)
		})

		it("should stop tracking when unwatched", () => {
			const reactiveObj = reactive({ count: 0 })
			let effectCount = 0

			const unwatch = effect(() => {
				effectCount++
				reactiveObj.count
			})

			expect(effectCount).toBe(1)

			unwatch()

			reactiveObj.count = 5
			expect(effectCount).toBe(1) // Should not trigger effect
		})

		it("should clean up dependencies on re-run", () => {
			const reactiveObj = reactive({ count: 0, name: "test" })
			let effectCount = 0

			effect(() => {
				effectCount++
				reactiveObj.count
			})

			expect(effectCount).toBe(1)

			// Change the effect to only watch name
			effect(() => {
				effectCount++
				reactiveObj.name
			})

			expect(effectCount).toBe(2)

			reactiveObj.count = 5
			expect(effectCount).toBe(3) // Should not trigger effect anymore

			reactiveObj.name = "new name"
			expect(effectCount).toBe(4) // Should trigger effect
		})
	})

	describe("error handling", () => {
		it("should propagate errors from effects", () => {
			const reactiveObj = reactive({ count: 0 })
			let effectCount = 0

			effect(() => {
				effectCount++
				reactiveObj.count

				if (reactiveObj.count === 1) {
					throw new Error("Test error")
				}
			})

			expect(effectCount).toBe(1)

			// This should throw an error when the effect runs
			expect(() => {
				reactiveObj.count = 1
			}).toThrow("Test error")

			expect(effectCount).toBe(2)
		})
	})

	describe("complex scenarios", () => {
		it("should handle multiple reactive objects", () => {
			const obj1 = reactive({ count: 0 })
			const obj2 = reactive({ name: "test" })
			let effectCount = 0

			effect(() => {
				effectCount++
				obj1.count
				obj2.name
			})

			expect(effectCount).toBe(1)

			obj1.count = 5
			expect(effectCount).toBe(2)

			obj2.name = "new name"
			expect(effectCount).toBe(3)
		})

		it("should handle object identity changes", () => {
			const reactiveObj = reactive({ inner: { count: 0 } })
			let effectCount = 0

			effect(() => {
				effectCount++
				reactiveObj.inner.count
			})

			expect(effectCount).toBe(1)

			reactiveObj.inner = { count: 5 }
			expect(effectCount).toBe(2)

			reactiveObj.inner.count = 10
			expect(effectCount).toBe(3)
		})
	})
})

describe("integration tests", () => {
	it("should work with complex nested structures", () => {
		const state = reactive({
			user: {
				profile: {
					name: "John",
					age: 30,
				},
				settings: {
					theme: "dark",
					notifications: true,
				},
			},
			app: {
				version: "1.0.0",
				features: ["auth", "chat"],
			},
		})

		let profileEffectCount = 0
		let settingsEffectCount = 0
		let appEffectCount = 0

		effect(() => {
			profileEffectCount++
			state.user.profile.name
			state.user.profile.age
		})

		effect(() => {
			settingsEffectCount++
			state.user.settings.theme
		})

		effect(() => {
			appEffectCount++
			state.app.version
		})

		expect(profileEffectCount).toBe(1)
		expect(settingsEffectCount).toBe(1)
		expect(appEffectCount).toBe(1)

		// Change profile
		state.user.profile.name = "Jane"
		expect(profileEffectCount).toBe(2)
		expect(settingsEffectCount).toBe(1)
		expect(appEffectCount).toBe(1)

		// Change settings
		state.user.settings.theme = "light"
		expect(profileEffectCount).toBe(2)
		expect(settingsEffectCount).toBe(2)
		expect(appEffectCount).toBe(1)

		// Change app
		state.app.version = "1.1.0"
		expect(profileEffectCount).toBe(2)
		expect(settingsEffectCount).toBe(2)
		expect(appEffectCount).toBe(2)
	})
})

describe("Reactive mixin", () => {
	it("should make class instances reactive", () => {
		class TestClass {
			count = 0
			name = "test"

			increment() {
				this.count++
			}

			setName(newName: string) {
				this.name = newName
			}
		}

		const ReactiveTestClass = Reactive(TestClass)
		const instance = new ReactiveTestClass()

		let effectCount = 0
		effect(() => {
			effectCount++
			instance.count
		})

		expect(effectCount).toBe(1)
		expect(instance.count).toBe(0)

		instance.increment()
		expect(effectCount).toBe(2)
		expect(instance.count).toBe(1)
	})

	it("should track property changes on reactive class instances", () => {
		class User {
			name = "John"
			age = 30

			updateProfile(newName: string, newAge: number) {
				this.name = newName
				this.age = newAge
			}
		}

		const ReactiveUser = Reactive(User)
		const user = new ReactiveUser()

		let nameEffectCount = 0
		let ageEffectCount = 0

		effect(() => {
			nameEffectCount++
			user.name
		})

		effect(() => {
			ageEffectCount++
			user.age
		})

		expect(nameEffectCount).toBe(1)
		expect(ageEffectCount).toBe(1)

		user.updateProfile("Jane", 25)
		expect(nameEffectCount).toBe(2)
		expect(ageEffectCount).toBe(2)
		expect(user.name).toBe("Jane")
		expect(user.age).toBe(25)
	})

	it("should work with inheritance", () => {
		class Animal {
			species = "unknown"
			energy = 100
		}

		class Dog extends Animal {
			breed = "mixed"
			bark() {
				this.energy -= 10
			}
		}

		const ReactiveDog = Reactive(Dog)
		const dog = new ReactiveDog()

		let energyEffectCount = 0
		effect(() => {
			energyEffectCount++
			dog.energy
		})

		expect(energyEffectCount).toBe(1)
		expect(dog.energy).toBe(100)

		dog.bark()
		expect(energyEffectCount).toBe(2)
		expect(dog.energy).toBe(90)
	})

	it("should handle method calls that modify properties", () => {
		class Counter {
			value = 0

			add(amount: number) {
				this.value += amount
			}

			reset() {
				this.value = 0
			}
		}

		const ReactiveCounter = Reactive(Counter)
		const counter = new ReactiveCounter()

		let effectCount = 0
		effect(() => {
			effectCount++
			counter.value
		})

		expect(effectCount).toBe(1)
		expect(counter.value).toBe(0)

		counter.add(5)
		expect(effectCount).toBe(2)
		expect(counter.value).toBe(5)

		counter.reset()
		expect(effectCount).toBe(3)
		expect(counter.value).toBe(0)
	})
})
