export const SEPARATOR = "/";
const HUB = Symbol();
const ACTION_TAG = Symbol();
const DEFAULT_HANDLER = Symbol();

type Initializer<T> = T extends Function ? never : (() => T) | T;

export type Action<
  A extends any[] = any[],
  T extends string = string,
  M = undefined
> = {
  type: T;
  meta: M;
  args: A;
};

type HubLike = { [HUB]: HubCore };

type HubCore = {
  parent?: HubCore;
  name?: string;

  setState(parent: HubLike, name?: string);
  addChild(parent: HubLike, name?: string);
  removeChild(child: HubLike);

  handleAction(a: Action): any;
  dispatch?;
};

const getHub = (hubLike) => hubLike[HUB];

export const getPath = (hubLike: HubLike, name?: string): string => {
  let hub = getHub(hubLike);

  const path: any = name ? [name] : [];
  while (hub) {
    path.push(hub.name);
    hub = hub.parent!;
  }
  return path.reverse().join(SEPARATOR);
};

const getDispatch = (hub) => {
  while (!hub.dispatch) {
    hub = hub.parent!;
  }
  return hub.dispatch;
};

export function dispatch<A extends any[] = any[], T extends string = string>(
  hubLike: HubLike,
  type: T,
  ...args: A
): Action<A, T>;
export function dispatch<
  A extends any[] = any[],
  T extends string = string,
  M = undefined
>(
  hubLike: HubLike,
  action: { type: T; meta: Initializer<M>; args: A }
): Action<A, T, M>;
export function dispatch(hubLike, arg1, ...rest) {
  const hub = getHub(hubLike);

  const action =
    typeof arg1 === "string"
      ? {
          type: arg1,
          meta: undefined,
          args: rest,
        }
      : { ...arg1 };

  action.meta = typeof action.meta === "function" ? action.meta() : action.meta;

  return getDispatch(hub)(action);
}

export const handleAction = (hubLike: HubLike, a: Action) =>
  getHub(hubLike).handleAction(a);

export function shouldHandleAction(hubLike: HubLike, a: Action): boolean;
export function shouldHandleAction(
  hubLike: HubLike,
  name: string,
  a: Action
): boolean;
export function shouldHandleAction(hub, arg2, arg3?) {
  const name = typeof arg2 === "string" ? arg2 : undefined;
  const action = name ? arg3 : arg2;

  return action.type.startsWith(getPath(hub, name));
}

type ActionDescriptor<T extends Function> = {
  fn: T;
  [ACTION_TAG]: true;
};

export const action = <T extends Function>(fn: T): ActionDescriptor<T> => ({
  fn,
  [ACTION_TAG]: true,
});

const isHub = (x): x is HubLike => x && !!getHub(x);
const isAction = (x) => x && x[ACTION_TAG];

const setHubState = (hub, parent?, name?) => {
  hub.parent = parent;
  hub.name = name;
};

const hubOptions: any = (arg1, arg2, arg3) => {
  // conf
  // name conf
  // parentModel conf
  // parentModel name conf

  const parent = isHub(arg1) ? arg1 : undefined;

  const name =
    typeof arg1 === "string"
      ? arg1
      : typeof arg2 === "string"
      ? arg2
      : undefined;

  const conf = parent ? (name ? arg3 : arg2) : name ? arg2 : arg1;

  return { parent, name, conf, meta: undefined };
};

export type Hub<T> = HubLike &
  {
    [P in keyof T]: T[P] extends ActionDescriptor<infer T> ? T : T[P];
  };

export function hub<T>(conf: T): Hub<T>;
export function hub<T>(name: string, conf: T): Hub<T>;
export function hub<T>(parent: HubLike, conf: T): Hub<T>;
export function hub<T>(parent: HubLike, name: string, conf: T): Hub<T>;
export function hub(...args) {
  return createHub(hubOptions(...args));
}

const createHub = ({ parent, name, conf, meta }) => {
  const defaultName = name;

  const hub: any = {
    parent: undefined as any,
    name: undefined as any,

    setState(parent?, name?) {
      setHubState(hub, parent, name || defaultName);

      if (parent && !hub.name) throw new Error("Hub name is required.");
    },

    addChild(child, name) {
      child = getHub(child);

      if (child.parent)
        throw new Error("Hub is already attached. You must detach it first.");

      child.setState(hub, name);
    },

    removeChild(child) {
      getHub(child).setState();
    },

    handleAction(a) {
      const path = getPath(hub);

      if (a.type.startsWith(path)) {
        const key = a.type.slice(path.length + 1);
        const action = conf[key];

        if (action) return action.fn.apply(self, a.args);
      }

      for (const k in conf) {
        const entry = conf[k];

        if (isHub(entry) && shouldHandleAction(entry, a))
          return handleAction(entry, a);
      }

      return self[DEFAULT_HANDLER]?.(a);
    },
  };

  hub[HUB] = hub;

  if (parent) getHub(parent).addChild(hub, name);

  const self: any = {};

  for (const k in conf) {
    const entry = conf[k];

    if (isAction(entry)) {
      self[k] = (...args) =>
        dispatch(hub, { type: getPath(hub, k), meta, args });
    } else if (isHub(entry)) {
      self[k] = entry;
      hub.addChild(entry, k);
    } else {
      self[k] = entry;
    }
  }

  self[DEFAULT_HANDLER] = conf[DEFAULT_HANDLER];
  self[HUB] = hub;
  return self;
};

hub.withMeta = (meta) => (...args) =>
  createHub({ ...hubOptions(...args), meta });

export type RootHub = HubLike & {
  add(name: string, hubLike: HubLike);
  remove(name: string);
  replace(hubs: Record<string, HubLike>);

  dispatch(action: Action);
  intercept(
    what: (action: Action) => boolean,
    fn: (action: Action, next: (action?: Action) => any) => any
  ): () => void;
  observe(
    what: (action: Action) => boolean,
    fn: (action: Action) => any
  ): () => void;
};

export function root(): RootHub;
export function root(name): RootHub;
export function root(hubs): RootHub;
export function root(name, hubs): RootHub;
export function root(arg1?, arg2?) {
  const name = typeof arg1 === "string" ? arg1 : "";
  const initialHubs = typeof arg1 === "string" ? arg2 : arg1;

  const hubs = {};

  // mw chain
  let head;
  let tail;
  //

  const self = {
    name,

    add(name, hub) {
      self.addChild(hub, name);
    },

    addChild(child, name) {
      if (hubs[name]) throw new Error("Hub with this name already exists.");

      child = getHub(child);
      child.setState(self, name);
      hubs[name] = child;
    },

    remove(name) {
      const child = hubs[name];
      if (child) self.removeChild(child);
    },

    removeChild(child) {
      child = getHub(child);

      const name = child.name;
      child.setState();
      delete hubs[name];
    },

    replace(nextHubs) {
      for (const k in hubs) self.remove(k);

      for (const k in nextHubs) self.add(k, nextHubs[k]);
    },

    handleAction(action) {
      let result;

      for (const k in hubs) {
        const entry = hubs[k];

        if (shouldHandleAction(entry, action)) {
          result = handleAction(entry, action);
        } else {
          handleAction(entry, action);
        }
      }

      return result;
    },

    dispatch(action) {
      function _next(_action, refEntry) {
        while (refEntry && !refEntry.what(_action)) {
          refEntry = refEntry.next;
        }

        const nextEntry = refEntry?.next;

        // refEntry has been removed
        if (refEntry === null || nextEntry === null) return;

        if (refEntry) {
          return refEntry.fn(_action, (a) => {
            return _next(a || _action, refEntry.next);
          });
        } else {
          return self.handleAction(_action);
        }
      }

      return _next(action, head);
    },

    intercept(what, fn) {
      const entry = { what, fn, prev: tail, next: undefined as any };

      if (tail) tail = tail.next = entry;
      else head = tail = entry;

      return () => {
        if (entry.prev) entry.prev.next = entry.next;
        else head = entry.next;

        if (entry.next) entry.next.prev = entry.prev;
        else tail = entry.prev;

        entry.next = null;
      };
    },

    observe(what, fn) {
      return self.intercept(what, (action, next) => {
        fn(action);
        return next();
      });
    },
  };

  self[HUB] = self;

  if (initialHubs) self.replace(initialHubs);

  return self as any;
}

hub.defaultHandler = DEFAULT_HANDLER;
hub.action = action;
hub.dispatch = dispatch;
hub.handleAction = handleAction;
hub.shouldHandleAction = shouldHandleAction;
hub.getPath = getPath;
hub.root = root;

export default hub;

export * from "./middleware";
