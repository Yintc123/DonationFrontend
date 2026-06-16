import { BffError } from './BffError'

export class ForbiddenError extends BffError {
  constructor(message: string, cause?: unknown) {
    super('FORBIDDEN', 403, message, cause)
  }
}
