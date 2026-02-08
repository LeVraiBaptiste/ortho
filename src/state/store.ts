type Callback<T> = (value: T) => void

type Store<T> = {
  readonly get: () => T
  readonly set: (value: T) => void
  readonly subscribe: (callback: Callback<T>) => () => void
}

export const createStore = <T>(initial: T): Store<T> => {
  let current: T = initial
  const subscribers = new Set<Callback<T>>()

  const get = (): T => current

  const set = (value: T): void => {
    current = value
    subscribers.forEach((cb) => cb(current))
  }

  const subscribe = (callback: Callback<T>): (() => void) => {
    subscribers.add(callback)
    return () => {
      subscribers.delete(callback)
    }
  }

  return { get, set, subscribe }
}
