export class GitsError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GitsError'
  }
}
export function safeError(error: unknown): GitsError {
  return error instanceof GitsError
    ? error
    : new GitsError(
      'unexpected',
      'The operation failed. Your saved leads are still available. Please retry.',
    )
}
