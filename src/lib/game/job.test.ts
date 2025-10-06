import { beforeEach, describe, expect, it } from 'vitest'
import type { Job } from './job'
import { calculateJobScore, JobType } from './job'
import type { Character } from './population/character'

describe('Job System', () => {
	describe('JobType validation', () => {
		it('should accept valid job types', () => {
			expect(JobType.allows('harvest')).toBe(true)
			expect(JobType.allows('transform')).toBe(true)
			expect(JobType.allows('convey')).toBe(true)
			expect(JobType.allows('gather')).toBe(true)
		})

		it('should reject invalid job types', () => {
			expect(JobType.allows('invalid')).toBe(false)
			expect(JobType.allows('')).toBe(false)
			expect(JobType.allows(null)).toBe(false)
			expect(JobType.allows(undefined)).toBe(false)
		})
	})

	describe('calculateJobScore', () => {
		let mockCharacter: Character

		beforeEach(() => {
			mockCharacter = {
				uid: 'test-char',
				position: { q: 0, r: 0 },
				fatigue: 50,
				energy: 100,
			} as any
		})

		it('should return urgency as score', () => {
			const job: Job = {
				type: 'harvest',
				fatigue: 10,
				urgency: 3,
			}

			expect(calculateJobScore(mockCharacter, job)).toBe(3)
		})

		it('should handle different urgency levels', () => {
			const jobs: Job[] = [
				{ type: 'harvest', fatigue: 5, urgency: 1 },
				{ type: 'transform', fatigue: 8, urgency: 2 },
				{ type: 'convey', fatigue: 3, urgency: 3 },
				{ type: 'gather', fatigue: 6, urgency: 1 },
			]

			jobs.forEach((job, _index) => {
				expect(calculateJobScore(mockCharacter, job)).toBe(job.urgency)
			})
		})

		it('should handle edge case urgency values', () => {
			const edgeCases: Job[] = [
				{ type: 'harvest', fatigue: 0, urgency: 0 },
				{ type: 'transform', fatigue: 100, urgency: 10 },
				{ type: 'convey', fatigue: 1, urgency: 0.5 },
			]

			edgeCases.forEach((job) => {
				expect(calculateJobScore(mockCharacter, job)).toBe(job.urgency)
			})
		})
	})

	describe('Job interface compliance', () => {
		it('should accept jobs with all required properties', () => {
			const validJobs: Job[] = [
				{ type: 'harvest', fatigue: 5, urgency: 1 },
				{ type: 'transform', fatigue: 8, urgency: 2 },
				{ type: 'convey', fatigue: 3, urgency: 1 },
				{ type: 'gather', fatigue: 6, urgency: 1 },
			]

			validJobs.forEach((job) => {
				expect(typeof job.type).toBe('string')
				expect(typeof job.fatigue).toBe('number')
				expect(typeof job.urgency).toBe('number')
				expect(job.fatigue).toBeGreaterThanOrEqual(0)
				expect(job.urgency).toBeGreaterThan(0)
			})
		})

		it('should handle jobs with extreme values', () => {
			const extremeJobs: Job[] = [
				{ type: 'harvest', fatigue: 0, urgency: 1 },
				{ type: 'transform', fatigue: 1000, urgency: 10 },
				{ type: 'convey', fatigue: 0.1, urgency: 0.1 },
			]

			extremeJobs.forEach((job) => {
				expect(typeof job.type).toBe('string')
				expect(typeof job.fatigue).toBe('number')
				expect(typeof job.urgency).toBe('number')
			})
		})
	})

	describe('Job scoring edge cases', () => {
		let mockCharacter: Character

		beforeEach(() => {
			mockCharacter = {
				uid: 'test-char',
				position: { q: 0, r: 0 },
				fatigue: 50,
				energy: 100,
			} as any
		})

		it('should handle zero urgency', () => {
			const job: Job = { type: 'harvest', fatigue: 5, urgency: 0 }
			expect(calculateJobScore(mockCharacter, job)).toBe(0)
		})

		it('should handle very high urgency', () => {
			const job: Job = { type: 'harvest', fatigue: 5, urgency: 1000 }
			expect(calculateJobScore(mockCharacter, job)).toBe(1000)
		})

		it('should handle fractional urgency', () => {
			const job: Job = { type: 'harvest', fatigue: 5, urgency: 2.5 }
			expect(calculateJobScore(mockCharacter, job)).toBe(2.5)
		})

		it('should handle negative fatigue gracefully', () => {
			const job: Job = { type: 'harvest', fatigue: -5, urgency: 2 }
			expect(calculateJobScore(mockCharacter, job)).toBe(2) // Should still work
		})
	})

	describe('Job type consistency', () => {
		it('should maintain consistent job type values', () => {
			const expectedTypes = ['harvest', 'transform', 'convey', 'gather']

			expectedTypes.forEach((type) => {
				expect(JobType.allows(type)).toBe(true)
			})
		})

		it('should handle case sensitivity', () => {
			const invalidCases = ['Harvest', 'TRANSFORM', 'Convey', 'Gather']

			invalidCases.forEach((type) => {
				expect(JobType.allows(type)).toBe(false)
			})
		})
	})
})
