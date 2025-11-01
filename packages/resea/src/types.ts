/**
 * Base type for all Sea store states - represents a generic object with key-value pairs
 * 
 * All store states must extend this type (implicitly through object shapes)
 */
export type SeaState = Record<PropertyKey, any>;

/**
 * Payload type for updating store state via `setState`
 * 
 * Supports two update patterns:
 * 1. Direct partial state object (e.g., { name: "New Name" })
 * 2. Functional updater that receives previous state and returns partial state
 */
export type Payload<T extends SeaState> =
  | Partial<T>
  | ((prevState: T) => Partial<T>);

/**
 * Payload type for patching store state via `$patch`
 * 
 * Supports two update patterns:
 * 1. Direct partial state object (similar to Payload but without functional form)
 * 2. Mutating function that receives a draft state to modify directly
 */
export type PatchPayload<T extends SeaState> =
  | Partial<T>
  | ((state: T) => void);

export type SeaGetterCache<T, S = Partial<T>> = {
  value: any;
  version: number;
  stateSnapshot: S;
};
/**
 * Event type emitted when a store action is executed
 * 
 * Contains metadata about the action execution (timing, arguments, results, errors)
 */
export interface SeaActionEvent {
  /** Unique ID of the store that contains the action */
  storeId: string;
  /** Name of the action that was executed */
  name: string;
  /** Arguments passed to the action */
  args: any[];
  /** Result returned by the action (if successful) */
  result?: any;
  /** Error thrown by the action (if failed) */
  error?: any;
  /** Timestamp when the action started (in milliseconds, from `performance.now()`) */
  startTime: number;
  /** Timestamp when the action completed (in milliseconds, from `performance.now()`) */
  endTime?: number;
  /** Duration of the action execution (endTime - startTime) */
  duration?: number;
}

/**
 * Core interface defining the structure of a Sea store
 * 
 * Contains state management logic, subscriptions, and core methods
 */
export interface SeaStore<T extends SeaState> {
  /** Unique identifier for the store */
  $id: string;
  /** Internal state container (direct modification is not recommended) */
  $state: T;
  /** Set of handlers notified when state is updated (used for React component subscriptions) */
  $setters: Set<(newPartialState: Partial<T>) => void>;
  /** Set of global subscribers notified of full state changes */
  _subscribers: Set<(newState: T, oldState: T) => void>;
  /** Flag to prevent concurrent state updates */
  _isUpdating: boolean;

  /**
   * Returns a copy of the current state (prevents direct mutation of internal state)
   * @returns {T} Current state of the store
   */
  getState: () => T;

  /**
   * Updates the store state using a payload
   * @param {Payload<T>} payload - Partial state or functional updater
   */
  setState: (payload: Payload<T>) => void;

  /** Resets the store state to its initial value (set during store creation) */
  $reset: () => void;

  /**
   * Subscribes to action events for this specific store
   * @param {(event: SeaActionEvent) => void} callback - Handler for action events
   * @returns {() => void} Unsubscribe function to clean up the handler
   */
  $onAction(callback: (event: SeaActionEvent) => void): () => void;

  /**
   * Subscribes to full state changes for this store
   * @param {(newState: T, oldState: T) => void} callback - Handler for state changes
   * @returns {() => void} Unsubscribe function to clean up the handler
   */
  $subscribe: (callback: (newState: T, oldState: T) => void) => () => void;

  /**
   * Patches the store state (supports direct mutation via draft in functional form)
   * @param {PatchPayload<T>} payload - Partial state or mutating function
   */
  $patch: (payload: PatchPayload<T>) => void;
}

/**
 * Return type of the `defineStore` function
 * Combines:
 * 1. A React hook to use the store in components
 * 2. Utility properties to access the store directly and get its ID
 */
export type DefineStoreType<
  Id extends string,
  T extends SeaState = SeaState,
  G extends SeaState = SeaState,
  A extends SeaState = SeaState
> = (() => SeaStore<T> & T & G & A & { $state: T; $id: Id }) & {
  /**
   * Directly retrieves the store instance (bypasses the React hook)
   * 
   * Useful for non-React contexts (e.g., utility functions, server-side code)
   * @returns {SeaStore<T> & T & G & A & { $state: T }} The store instance
   */
  $getStore: () => SeaStore<T> & T & G & A & { $state: T; $id: Id };
  /** Unique ID of the store (matches the ID passed to `defineStore`) */
  $id: Id;
};

/**
 * Interface defining a Sea plugin
 * 
 * Plugins extend Sea's functionality (e.g., logging, persistence, dev tools)
 */
export interface SeaPlugin {
  /** Unique name of the plugin (prevents duplicate installations) */
  name: string;
  /** Optional configuration options for the plugin */
  options?: any;
  /**
   * Install method called when the plugin is added to a Sea instance
   * 
   * Use this to register hooks, modify Sea behavior, or add new features
   * @param {SeaType} sea - The Sea instance the plugin is installed on
   */
  install?: (sea: SeaType) => void;
  /**
   * Hook called when a new store is created
   * Use this to initialize plugin logic for individual stores
   * @template T - Type of the newly created store's state
   * @param {SeaStore<T>} store - The newly created store
   */
  storeCreated?: <T extends SeaState>(store: SeaStore<T>) => void;
}

/**
 * Options passed to the `defineStore` function to configure a store
 * 
 * Defines the store's initial state, getters (computed values), and actions (methods)
 */
export interface DefineStoreOptions<
  T extends SeaState,
  G extends SeaState,
  A extends SeaState
> {
  /**
   * Function that returns the initial state of the store
   * 
   * Using a function ensures fresh state for each store instance (avoids shared references)
   * @returns {T} Initial state
   */
  state?: () => T;

  /**
   * Object of getter functions (computed values based on state)
   * 
   * Each getter receives the store state and other getters as arguments
   * 
   * Getters are cached and only re-computed when their dependencies change
   */
  getters?: { [K in keyof G]: (state: T, getters: G) => G[K] };

  /**
   * Object of action functions (methods that modify state or perform side effects)
   * 
   * Actions have access to the store's state, getters, and other actions via `this`
   * 
   * Supports async/await for asynchronous operations (automatically tracks loading state)
   * 
   * @this {T & G & A & { $reset: () => void; $state: T; setState: SeaStore<T>["setState"]; $onAction: SeaStore<T>["$onAction"]; $subscribe: SeaStore<T>["$subscribe"]; $patch: SeaStore<T>["$patch"] }}
   * `this` context includes:
   * - State properties (T)
   * - Getters (G)
   * - Other actions (A)
   * - Core store methods ($reset, setState, $onAction, $subscribe, $patch)
   * - $state (current state)
   */
  actions?: A &
    ThisType<
      T &
        G &
        A & {
          $reset: () => void;
          $state: T;
          setState: SeaStore<T>["setState"];
          $onAction: SeaStore<T>["$onAction"];
          $subscribe: SeaStore<T>["$subscribe"];
          $patch: SeaStore<T>["$patch"];
        }
  >;
  
  persist?: boolean | {
    /**
     * Storage key name
     */
    key?: string;
    /**
     * Storage method, defaults to localStorage
     */
    storage?: Storage;
    /**
     * Whether to persist initial default state
     */
    initState?: boolean;
    /**
     * Array of state paths to persist, defaults to all
     */
    paths?: string[];
    /**
     * Transformation function after loading state from storage
     */
    deserialize?: (value: string) => any;
    /**
     * Transformation function before saving state
     */
    serialize?: (value: any) => string;
  };
}

/**
 * Interface defining the global Sea instance
 * 
 * Manages all stores, plugins, and cross-store functionality
 */
export type SeaType = {
  /**
   * Placeholder install method (for compatibility with plugin systems)
   * 
   * Currently a no-op but preserved for future extensibility
   */
  install: () => void;

  /**
   * Installs a plugin to extend Sea's functionality
   * 
   * Prevents duplicate installations of the same plugin (by plugin name)
   * @param {SeaPlugin} plugin - Plugin to install
   * @returns {SeaType} The Sea instance (enables method chaining)
   */
  use(plugin: SeaPlugin): SeaType;

  /**
   * Retrieves a store by its unique ID
   * @template T - Type of the store's state
   * @param {string} id - ID of the store to retrieve
   * @returns {SeaStore<T> | undefined} The store instance (or undefined if not found)
   */
  getStore: <T extends SeaState>(id: string) => SeaStore<T> | undefined;

  /**
   * Map of all registered stores (key: store ID, value: store instance)
   * 
   * Provides direct access to all stores for advanced use cases
   */
  stores: Map<string, SeaStore<any>>;

  /**
   * Batch processing function for state updates
   * 
   * Uses React's `unstable_batchedUpdates` by default (if available)
   * 
   * Ensures multiple state updates in a single callback trigger only one re-render
   * @param {() => void} callback - Function containing state updates to batch
   */
  batchStore: (callback: () => void) => void;

  /**
   * Notifies all installed plugins that a new store has been created
   * 
   * Triggers the `storeCreated` hook on each plugin
   * @template T - Type of the newly created store's state
   * @param {SeaStore<T>} store - The newly created store
   */
  callStoreCreated<T extends SeaState>(store: SeaStore<T>): void;

  /**
   * Set of global action handlers (notified of all action events across all stores)
   * 
   * Plugins can add handlers here to listen to actions globally
   */
  actions: Set<(event: SeaActionEvent) => void>;

  /**
   * Emits an action event to all global action handlers
   * 
   * Called automatically when any store action completes (success or failure)
   * @param {SeaActionEvent} event - Action event to emit
   */
  emitAction: (event: SeaActionEvent) => void;
};
