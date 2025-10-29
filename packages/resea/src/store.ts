import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import {
  SeaState, Payload, PatchPayload, SeaStore, SeaPlugin, SeaType, SeaGetterCache,
  DefineStoreOptions, DefineStoreType, SeaActionEvent,
} from "./types";

const pathSeg = (p: string) => p.replace(/\[(\d+)\]/g, '.$1').split('.');
/**
 * Gets a value from an object by path string
 * @param obj Target object
 * @param path Path string, e.g., "user.name" or "items[0].id"
 * @returns The value at the specified path or undefined if not found
 */
function getValueByPath(obj: any, path: string): any {
  const segs = pathSeg(path);
  let cur: any = obj;
  for (const s of segs) {
    if (cur == null) break;
    cur = cur[s];
  }
  return cur;
}

/**
 * Sets a value in an object by path string
 * @param obj Target object
 * @param path Path string, e.g., "user.name" or "items[0].id"
 * @param value Value to set
 */
function setValueByPath(obj: any, path: string, value: any): void {
  const segs = pathSeg(path);
  let cur: any = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (cur[seg] == null || typeof cur[seg] !== 'object') {
      cur[seg] = /^\d+$/.test(segs[i + 1]) ? [] : {};
    }
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
}

/**
 * Creates a flat Map<path, value> for the given state object.
 * Used by both getters and useStore to keep dependency tracking simple.
 */
function createFlatSnapshot<T extends SeaState>(
  state: T, paths: Iterable<string>
): Map<string, unknown> {
  const snap = new Map<string, unknown>();
  for (const path of paths) {
    snap.set(path, getValueByPath(state, path));
  }
  return snap;
}

const pathCache = new Map<string, string[]>();
function pathChanged(state: any, path: string, snap: Map<string, unknown>): boolean {
  let segs = pathCache.get(path);
  let cur = state;
  if (!segs) {
    segs = pathSeg(path);
    pathCache.set(path, segs);
  }
  for (const s of segs) cur = cur?.[s];
  return cur !== snap.get(path);
}
/**
 * Returns true if any watched path changed since last snapshot.
 */
function hasPathChange<T extends SeaState>(
  state: T, paths: Iterable<string>, snap: Map<string, unknown>
): boolean {
  for (const path of paths) {
    if (pathChanged(state, path, snap)) return true;
  }
  return false;
}
/**
 * Creates a proxy for actions: accesses state properties recursively
 * and builds nested paths automatically when setting any property.
 */
function actionProxy<T extends SeaState>(store: SeaStore<T>): T & SeaStore<T> {
  const createProxy = (obj: any, path: string[] = []): any => {
    if (obj == null || typeof obj !== "object") return obj;
    return new Proxy(obj, {
      get(_, prop: string) {
        const value = obj[prop];
        const isObjs = value != null && typeof value === "object";
        return isObjs ? createProxy(value, [...path, prop]) : value;
      },
      set(_, prop: string, val) {
        const patch: any = {};
        path.reduce((o, key, i) => 
          (o[key] = i === path.length - 1 ? { [prop]: val } : {}), 
          patch
        );
        if (!path.length) patch[prop] = val;
        store.$patch(patch as Partial<T>);
        return true;
      },
    });
  }
  return new Proxy({} as any, {
    get(_, prop: string) {
      if (prop in store) return (store as any)[prop];
      const state = store.getState();
      if (prop in state) return createProxy(state[prop], [prop]);
    },
    set(_, prop: string, val) {
      store.$patch({ [prop]: val } as Partial<T>);
      return true;
    },
  });
}

// Default batch processing function that simply executes the callback
let batchStore = (cb: () => void) => { cb && cb(); };

// Global reference to the Sea instance
export let reSea = {} as SeaType;

/**
 * Configures global Sea settings
 * @param opts - Configuration options
 * @param opts.batchStore - Custom batch processing function (typically for React's batched updates)
 */
export const configSea = (opts?: { batchStore: typeof batchStore }) => {
  const batchedUpdates = typeof window !== "undefined" && (window as any).ReactDOM?.unstable_batchedUpdates;
  batchStore = reSea.batchStore = opts?.batchStore || batchedUpdates || ((cb: () => void) => cb());
};

/**
 * Creates a new Sea state management instance
 * @returns A new SeaType instance
 */
export const createSea = (): SeaType => {
  const stores = new Map<string, SeaStore<any>>();
  const plugins: SeaPlugin[] = [];
  const actionHandlers = new Set<(event: SeaActionEvent) => void>();
  // The main Sea instance implementation
  const seaInstance: SeaType = {
    // Plugin installation method (empty implementation)
    install() { },
    /**
     * Installs a plugin to extend Sea functionality
     * @param plugin - The plugin to install
     * @returns The Sea instance for method chaining
     */
    use(plugin: SeaPlugin) {
      // Prevent duplicate plugin installation
      if (plugins.some((p) => p.name === plugin.name)) {
        console.warn(`[Sea] plugin "${plugin.name}" already installed.`);
        return seaInstance;
      }
      plugins.push(plugin);
      plugin.install?.(seaInstance);
      return seaInstance;
    },
    /**
     * Retrieves a store by its ID
     * @param id - The unique ID of the store
     * @returns The requested store or undefined if not found
     */
    getStore: <T extends SeaState>(id: string) => stores.get(id) as SeaStore<T> | undefined,
    // Expose the stores map
    stores,
    // Expose the batch processing function
    batchStore,
    /**
     * Notifies plugins when a new store is created
     * @param store - The newly created store
     */
    callStoreCreated<T extends SeaState>(store: SeaStore<T>) {
      plugins.forEach((p) => p.storeCreated?.(store));
    },
    // Expose the action handlers set
    actionHandlers,
    // Expose the action emitter
    emitAction(event: SeaActionEvent) {
      actionHandlers.forEach((fn) => {
        try {
          fn(event);
        } catch (e) {
          console.error("[Sea] emitAction error:", e);
        }
      });
    },
  };
  reSea = seaInstance;
  return seaInstance;
};

/**
 * Defines a new store with state, getters, and actions
 * @param {Id} $id - Unique identifier for the store
 * @param {DefineStoreOptions<T, G, A>} [options] - Configuration options for the store
 * @returns {DefineStoreType<Id, T, G, A>} A function to use the store in components, with store utilities
 */
export function defineStore<
  Id extends string, T extends SeaState = {}, G extends SeaState = {}, A extends SeaState = {}
>($id: Id, options: DefineStoreOptions<T, G, A> = {}): DefineStoreType<Id, T, G, A> {
  // Check if Sea instance exists, create one if not
  if (!reSea.stores) {
    console.warn("[Sea Tips] Store not initialized, auto-calling createSea()");
    createSea();
  }
  // Development validation: Ensure store has a unique ID
  if (!$id) {
    throw new Error(
      '[Sea Tips] Store must have a unique id (e.g. defineStore("user", { ... }))'
    );
  }
  // Return existing store if it already exists
  if (reSea.stores.has($id)) {
    const existingStore = reSea.stores.get($id)! as SeaStore<T> & T & G & A & { $state: T };
    const existStore = () => useStore(existingStore);
    return Object.assign(existStore, {
      $getStore: () => existingStore,
      $id,
    }) as DefineStoreType<Id, T, G, A>;
  }

  // State management variables
  let stateVersion = 0;
  const initialState = (options.state || (() => ({} as T)))();
  const depMap = new Map<keyof G, Set<string>>();
  const cacheMap = new Map<keyof G, SeaGetterCache<T, Map<string, unknown>>>();
  // Base store implementation with core functionality
  const baseStore: SeaStore<T> = {
    $id,
    $state: { ...initialState },
    $setters: new Set(),
    _subscribers: new Set(),
    _isUpdating: false,
    /**
     * Gets a copy of the current state
     * @returns {T} A copy of the current state
     */
    getState(): T {
      return { ...this.$state };
    },
    /**
     * Updates the store state
     * @param {Payload<T>} payload - Either a partial state object or a function that returns one
     */
    setState(payload: Payload<T>) {
      if (this._isUpdating) return;
      // Use batch processing for state updates
      reSea.batchStore(() => {
        try {
          this._isUpdating = true;
          const prevState = this.$state;
          const fnState = typeof payload === "function" ? payload(prevState) : payload;
          const hasChanges = Object.keys(fnState).some((k) => fnState[k as keyof T] !== prevState[k as keyof T]);
          if (!hasChanges) return;
          this.$state = Object.assign({}, prevState, fnState);
          stateVersion++;
          const changed = new Set<string>(Object.keys(fnState));
          depMap.forEach((deps, k) => {
            for (const d of deps)
              if (changed.has(d)) {
                cacheMap.delete(k);
                break;
              }
          });
          this.$setters.forEach((setter) => setter(fnState));
          this._subscribers.forEach((cb) => cb(this.$state, prevState));
        } finally {
          this._isUpdating = false;
        }
      });
    },
    /**
     * Resets the store to its initial state
     */
    $reset() {
      this.setState({ ...initialState });
    },
    /**
     * Registers a callback for action events in this store
     * @param {(event: SeaActionEvent) => void} callback - The callback to register
     * @returns {() => void} A function to unregister the callback
     */
    $onAction(callback: (event: SeaActionEvent) => void): () => void {
      const wrapped = (e: SeaActionEvent) => {
        if (e.storeId === $id) callback(e);
      };
      reSea.actionHandlers.add(wrapped);
      return () => reSea.actionHandlers.delete(wrapped);
    },
    /**
     * Subscribes to state changes
     * @param callback - Function called when state changes
     * @returns {() => void} A function to unsubscribe
     */
    $subscribe(callback): () => void {
      this._subscribers.add(callback);
      return () => this._subscribers.delete(callback);
    },
    /**
     * Patches the state with partial updates or a mutating function
     * @param {PatchPayload<T>} payload - Either a partial state or a mutating function
     */
    $patch(payload: PatchPayload<T>) {
      const rawState = this.getState();
      const setSubscribe = (value: Partial<T>) => {
        Object.assign(this.$state, value);
        this.$setters.forEach((setter) => setter(value));
        this._subscribers.forEach((cb) => cb(this.$state, rawState));
      }
      if (typeof payload === "function") {
        const changed: SeaState = {};
        const draft = new Proxy(this.$state, {
          set: (target, prop: keyof T, val) => {
            if (target[prop] !== val) {
              changed[prop] = val;
              target[prop] = val;
            }
            return true;
          },
          get: (target, prop) => {
            if (prop === "_isDraft") return true;
            const value = target[prop];
            if (typeof value === "object" && value !== null && !value._isDraft) {
              return new Proxy(value, {
                set: (obj, k, v) => {
                  changed[prop as string] = { ...target[prop as string], [k]: v };
                  obj[k as any] = v;
                  return true;
                },
              });
            }
            return value;
          },
        });
        payload.call(this, draft);
        if (Object.keys(changed).length) setSubscribe(changed);
      } else {
        setSubscribe(payload);
      }
    },
  };

  if (options.getters) {
    Object.keys(options.getters).forEach((key) => {
      const gKey = key as keyof G;
      /**
       * Creates a tracer to track which state properties a getter depends on
       * @returns {Object} An object containing the tracer proxy and tracked paths
       */
      const createTracer = (): { tracer: any; paths: Set<string> } => {
        const paths = new Set<string>();
        const createNestedTracer = (obj: any, parentPath: string = "") => {
          return new Proxy(obj, {
            get(target, prop: string) {
              const currentPath = parentPath ? `${parentPath}.${prop}` : prop;
              paths.add(currentPath);
              const value = target[prop];
              const isEmpty = typeof value === "object" && value !== null && !Array.isArray(value)
              return isEmpty ? createNestedTracer(value, currentPath) : value;
            },
            has(target, prop: string) {
              paths.add(parentPath ? `${parentPath}.${prop}` : prop);
              return prop in target;
            },
          });
        };
        const tracer = createNestedTracer(baseStore.$state);
        return { tracer, paths };
      };
      // Define getter property on the store
      const tracerCache = new Map<keyof G, any>();
      const getGetterCache = (gKey: keyof G) => {
        const cached = cacheMap.get(gKey);
        const paths = depMap.get(gKey);
        if (
          cached && cached.version === stateVersion && paths &&
          !hasPathChange(baseStore.$state, paths, cached.stateSnapshot)
        ) {
          return cached.value;
        }
        const pathTracer = paths && tracerCache.has(gKey);
        const tcVal = pathTracer ? tracerCache.get(gKey) : createTracer()
        const tracerVal = pathTracer ? tcVal : tcVal.tracer;
        const pathsVal: Set<string> = pathTracer ? paths : tcVal.paths;
        if (!pathTracer) {
          depMap.set(gKey, pathsVal);
          tracerCache.set(gKey, tracerVal);
        }
        const value = options.getters![gKey](tracerVal, baseStore as unknown as G);
        cacheMap.set(gKey, {
          value,
          version: stateVersion,
          stateSnapshot: createFlatSnapshot(baseStore.$state, pathsVal),
        });
        return value;
      };
      Object.defineProperty(baseStore, gKey, {
        get: () => getGetterCache(gKey),
        enumerable: true,
        configurable: false,
      });
    });
  }

  if (options.actions) {
    Object.keys(options.actions).forEach((key) => {
      const aKey = key as keyof A;
      const raw = options.actions![aKey];
      (baseStore as any)[aKey] = async function (...args: any[]) {
        const startTime = performance.now();
        const event: SeaActionEvent = {
          storeId: $id,
          name: String(aKey),
          args,
          startTime,
        };
        const isAsync = raw.constructor.name === "AsyncFunction";
        const loadingKey = `${String(aKey)}Loading` as keyof T;
        if (isAsync && baseStore.$state[loadingKey] !== true) {
          baseStore.setState({ [loadingKey]: true } as unknown as Partial<T>);
        }
        try {
          return event.result = await raw.apply(actionProxy(baseStore), args);
        } catch (error) {
          event.error = error;
          console.error(`[Sea Tips] Action "${String(aKey)}" failed:`, error);
          throw error;
        } finally {
          const endTime = performance.now();
          event.endTime = endTime;
          event.duration = endTime - startTime;
          reSea.emitAction(event);
          if (isAsync && baseStore.$state[loadingKey] === true) {
            baseStore.setState({ [loadingKey]: false } as unknown as Partial<T>);
          }
        }
      };
    });
  }

  // Add persistence logic in the defineStore function
  if (options.persist && typeof window !== 'undefined') {
    const defConf = typeof options.persist === 'boolean' ? {} : options.persist;
    const opts = Object.assign({ key: `sea_${$id}`, storage: localStorage || window.localStorage }, defConf);
    const saved = opts.storage.getItem(opts.key);
    const setStorage = (baseState: T | Record<string, any>) => {
      let stateToSave: T | Record<string, any> = baseState;
      if (opts.paths && opts.paths.length > 0) {
        stateToSave = {} as Record<string, any>;
        opts.paths.forEach(path => setValueByPath(stateToSave, path, getValueByPath(baseState, path)));
      }
      opts.storage.setItem(opts.key, (opts.serialize || JSON.stringify)(stateToSave));
    }
    if (saved) {
      Object.assign(baseStore.$state, (opts.deserialize || JSON.parse)(saved));
    } else {
      if (opts.initState) setStorage(baseStore.$state);
    }
    baseStore.$subscribe((newState) => setStorage(newState));
  }

  // Create a proxy to simplify state access and modifications
  const storeProxy = new Proxy(baseStore, {
    get(target, prop: keyof SeaStore<T> & T & G & A & { $state: T }) {
      if (prop === "$state") return target.getState();
      if (prop in target) return target[prop as keyof SeaStore<T>];
      if (prop in target.$state) return target.$state[prop as keyof T];
      if ((options.actions && prop in options.actions) ||
        (options.getters && prop in options.getters)) {
        return (target as any)[prop];
      }
      return undefined;
    },
    set(target, prop: keyof T, value) {
      if (target.$state[prop] !== value) {
        target.setState({ [prop]: value } as Partial<T>);
      }
      return true;
    },
  }) as SeaStore<T> & T & G & A & { $state: T };
  reSea.stores.set($id, baseStore);
  reSea.callStoreCreated(baseStore);
  const currentStore = () => useStore(storeProxy);
  return Object.assign(currentStore, { $getStore: () => storeProxy, $id, }) as DefineStoreType<Id, T, G, A>;
}

/**
 * React hook to access and subscribe to a Sea store with automatic dependency tracking
 * @param {SeaStore<T> & T & G & A & { $state: T }} store - The Sea store instance to use
 * @returns {SeaStore<T> & T & G & A & { $state: T }} A proxied store instance that tracks used state dependencies
 */
function useStore<T extends SeaState, G extends SeaState, A extends SeaState>(
  store: SeaStore<T> & T & G & A & { $state: T }
): SeaStore<T> & T & G & A & { $state: T } {
  // Ref to hold metadata for dependency tracking and state snapshot
  // - deps: Tracks which state properties the component uses
  // - snap: Snapshot of the used state properties for change detection
  const meta = useRef({ deps: new Set<keyof T>(), snap: new Map<string, unknown>() }).current;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (partial: Partial<T>) => {
        const changed = Array.from(meta.deps).some((k) => partial[k] !== meta.snap.get(String(k)));
        if (changed) onStoreChange();
      };
      store.$setters.add(handler);
      return () => store.$setters.delete(handler);
    },
    [store, meta]
  );

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const paths = Array.from(meta.deps).map(String);
    if (!hasPathChange(state, paths, meta.snap)) return meta.snap;
    return (meta.snap = createFlatSnapshot(state, paths));
  }, [store, meta]);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => {
    const shouldTrack = process.env.NODE_ENV !== 'production' || !meta.deps.size;
    if (!shouldTrack && meta.deps.size > 0) return store;
    return new Proxy(store, {
      get(target, prop: keyof T) {
        if (prop in target.$state) meta.deps.add(prop);
        return target[prop];
      },
      set(target, prop: keyof T, val) {
        if (target.$state[prop] !== val) target.setState({ [prop]: val } as any);
        return true;
      },
    });
  }, [store, meta]) as SeaStore<T> & T & G & A & { $state: T };
}
