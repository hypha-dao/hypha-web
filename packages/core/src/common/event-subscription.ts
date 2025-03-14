// Define a type for subscriber callbacks
type Subscriber = (state: any) => void;

export const createEventSubscription = <T>() => {
  // Array to hold subscriber callbacks
  const _subscribers: Subscriber[] = [];

  // Notify all subscribers with the current state
  const _notifySubscribers = (state: T) => {
    _subscribers.forEach((subscriber) => subscriber(state));
  };

  const _subscribe = (callback: Subscriber) => {
    _subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = _subscribers.indexOf(callback);
      if (index !== -1) {
        _subscribers.splice(index, 1);
      }
    };
  };

  return {
    subscribe: _subscribe,
    send: _notifySubscribers,
  };
};
