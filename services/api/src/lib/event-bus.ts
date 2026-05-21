type EventHandler<T> = (payload: T) => void;

export class RuntimeEventBus<TEvents extends Record<string, unknown>> {
  private readonly handlers = new Map<
    keyof TEvents,
    Set<EventHandler<unknown>>
  >();

  public publish<TKey extends keyof TEvents>(
    eventName: TKey,
    payload: TEvents[TKey],
  ) {
    const handlers = this.handlers.get(eventName);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(payload);
    }
  }

  public subscribe<TKey extends keyof TEvents>(
    eventName: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ) {
    const handlers = this.handlers.get(eventName) ?? new Set();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(handler as EventHandler<unknown>);
    };
  }
}
