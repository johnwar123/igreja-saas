const routes = new Map();
let notFoundHandler = null;
let beforeEachHooks = [];

export function addRoute(path, handler) {
  routes.set(path, handler);
}

export function setNotFoundHandler(handler) {
  notFoundHandler = handler;
}

export function beforeEach(hook) {
  beforeEachHooks.push(hook);
}

function matchRoute(path) {
  for (const [routePath, handler] of routes) {
    const regex = routeToRegex(routePath);
    const match = path.match(regex);
    if (match) {
      const params = {};
      const paramNames = getParamNames(routePath);
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler, params };
    }
  }
  return null;
}

function routeToRegex(path) {
  const regexStr = path
    .replace(/\//g, '\\/')
    .replace(/:(\w+)/g, '([^/]+)');
  return new RegExp(`^${regexStr}$`);
}

function getParamNames(path) {
  const matches = path.match(/:(\w+)/g);
  return matches ? matches.map(m => m.slice(1)) : [];
}

export async function navigate(path) {
  window.location.hash = `#${path}`;
}

export async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const [path] = hash.split('?');
  
  for (const hook of beforeEachHooks) {
    const result = await hook(path);
    if (result === false) return;
  }

  const match = matchRoute(path);
  if (match) {
    await match.handler(match.params);
  } else if (notFoundHandler) {
    await notFoundHandler(path);
  } else {
    console.warn('Rota não encontrada:', path);
  }
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}