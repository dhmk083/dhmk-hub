# @dhmk/hub

Action dispatching system with middleware and devtools support.

Allows you to dispatch and listen to custom actions, intercept and modify actions, and provides helpers to define `action + handler` pair as a regular method function.

Install: `yarn add @dhmk/hub`

# Example

```ts
import hub, { logger, devTools } from "@dhmk/hub";

const example = hub({
  items: [] as any[],

  createItem: hub.action(() => {
    const id = Date.now() & 0xfff;

    const item = hub.withMeta({ id })(example, "item", {
      id,
      name: "item",

      setName: hub.action((name) => (item.name = name)),
    });

    example.items.push(item);

    hub.dispatch(example, "my_action", 1, 2, 3);
    // hub.dispatch(example, {type: 'my_action', args: [1, 2, 3]})

    return item;
  }),

  logger: hub("logger", {
    log: hub.action((...args) => {
      console.log("log", ...args);
      return 123;
    }),

    asyncLog: hub.action(function (x) {
      return setTimeout(this.log, 10, x);
    }),

    promiseLog: hub.action((x) => {
      console.log("promiseLog", x);
      return new Promise((res) => {
        setTimeout(res, 10, x);
      });
    }),
  }),

  [hub.defaultHandler]: (a) => {
    if (hub.shouldHandleAction(example, "item", a))
      return hub.handleAction(
        example.items.find((x) => x.id === a.meta.id),
        a
      );
  },
});

const root = hub.root("root", { example });
// root.add("example", example);

logger(root);
devTools(root);

export default class App extends React.Component {
  render() {
    return (
      <div>
        <h1>Test app</h1>
        <div>
          <button
            onClick={() =>
              example.logger.log({ id: 111, name: "test" }, "pizza", 10)
            }
          >
            Log
          </button>
          <button onClick={() => example.logger.asyncLog(222)}>
            Log async
          </button>
          <button onClick={() => example.logger.promiseLog(333)}>
            Log promise
          </button>
        </div>
        <button
          onClick={() => {
            example.createItem();
            this.forceUpdate();
          }}
        >
          Create
        </button>
        <hr />
        <ul>
          {example.items.map((x) => (
            <li key={x.id}>
              #{x.id} {x.name}{" "}
              <button
                onClick={() => {
                  x.setName(Math.random());
                  this.forceUpdate();
                }}
              >
                set name
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
```

# API

- hub(parentHub?: Hub, name?: string, conf: {}): Hub

  Copies all props from `conf` to a new object and replaces found own actions with methods.

- hub.withMeta(meta: T | () => T)(parentHub?: Hub, name?: string, conf: {}): Hub

  All own actions will include `meta` data.

- hub.defaultHandler: (action) => R

  Called when no own action handlers match current action.

- hub.action(fn): fn

  Creates action + handler pair. When called, it will dispatch an action with provided arguments. When a hub will handle this action, it will call `fn` with provided arguments.

- dispatch(hub, type, ...args)

  - dispatch(hub, {type, meta, args})

  Dispatches an action

- handleAction(hub, action)

  Calls hub action handler performing side-effects

- shouldHandleAction(hub, name?: string, action)

  Helper that checks if action type starts with hub path

- root(name?: string, initialHubs: {}): Root

  Creates root hub which can add/remove other hubs and dispatch actions through them.

  Root methods:

  - add(name: string, hub)
  - remove(name: string)
  - replace(hubs: {})
  <!-- pad -->
  - dispatch(action)
  - intercept(filter: action => boolean, handler: (action, next) => R): DisposeFn
  - observe(filter: action => boolean, handler: (action) => void): DisposeFn

- getPath(hub, name?: string): string

  Get full path of a hub, optionally with `name` suffix.

- devTools(root): DisposeFn

  Attach [devtools](https://github.com/zalmoxisus/redux-devtools-extension)

- logger(root): DisposeFn

  Simple action logger
