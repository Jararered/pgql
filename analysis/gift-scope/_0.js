// Inert recovered excerpt; dependencies unresolved. Source: agents-readable/main_agent.js:82616
async function _0(i, e, t = 10, r = 500) {
  for (let n = 0; n < t; n++) {
    info(`Attempt ${n + 1} of ${t}`);
    try {
      return await g0e(i(), e);
    } catch (o) {
      if ((info(`Attempt ${n + 1} failed: ${o}`), n === t - 1)) throw o;
      (info(`Waiting ${r * (n + 1)}ms before retrying...`),
        await new Promise((s) => setTimeout(s, r * (n + 1))));
    }
  }
}
