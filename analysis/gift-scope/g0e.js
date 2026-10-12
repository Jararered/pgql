// Inert recovered excerpt; dependencies unresolved. Source: agents-readable/main_agent.js:82605
var g0e = a(
  (i, e) =>
    new Promise((t, r) => {
      let n = e.match(/^System\.Action<(.+)>$/)?.[1];
      if (!n) return r(Error(`Unsupported Promise delegate type: ${e}`));
      let o = T.cast(i, `Niantic.Promises.Promise<${n}>`);
      (o.Error(T.delegate("System.Action<string>", (s) => r(Error(s)), !0)),
        o.Then(T.delegate(e, (s) => t(s), !0)));
    }),
  "sync",
);
