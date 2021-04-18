import { RootHub } from "./index";

export const logger = (root: RootHub) =>
  root.intercept(
    () => true,
    (action, next) => {
      const res = next();

      console.log(
        `%c<action>: ${action.type}`,
        "color: green; font-weight: bold;",
        "(",
        ...([].concat.apply as any)(
          [],
          action.args?.map((a) => [a, ","])
        ).slice(0, -1),
        ") =>",
        res
      );

      return res;
    }
  );

export const devTools = (root: RootHub) => {
  const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__;

  if (!devTools) {
    console.warn("No dev tools detected.");
    return () => {};
  }

  let _state;
  let _notify;
  const skip = Symbol();

  // Create a fake redux store to be able to use `dispatch action` button in devTools.
  const createStore = (reducer, initialState) => {
    _state = initialState;

    const store = {
      getState: () => _state,
      dispatch: (a) => {
        _state = reducer(_state, a);
        _notify?.();
        const { action } = a;
        if (action && !action[skip]) root.dispatch(action);
        return a;
      },
      subscribe: (fn) => {
        _notify = fn;
        return () => {};
      },
    };
    store.dispatch({ type: "@@redux/INIT" });
    return store;
  };

  const dt = devTools()(createStore)(() => {});

  return root.observe(
    () => true,
    (a) => {
      a[skip] = true;
      dt.dispatch(a);
    }
  );
};
