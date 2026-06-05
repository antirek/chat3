export class CounterProcessorError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message);
    this.name = 'CounterProcessorError';
  }
}
