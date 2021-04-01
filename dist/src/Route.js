import { EventManager, matchPattern } from '@axtk/event-manager';
import { getPath } from './getPath';
import { isRouteLink } from './isRouteLink';
export const DefaultPathProps = {
    pathname: true,
    search: false,
    hash: false,
};
export class Route {
    constructor(initialPath, pathProps) {
        this.pathProps = {
            ...DefaultPathProps,
            ...pathProps,
        };
        this.eventManager = new EventManager();
        this.dispatch(initialPath); // sets this.href
        this.subscriptions = [];
        if (typeof window !== 'undefined')
            window.addEventListener('popstate', () => this.dispatch());
    }
    onChange(handler) {
        let listener = this.eventManager.addListener('*', event => {
            let { type, params, ...props } = event;
            handler({ ...props, params, path: type });
        });
        return () => listener.remove();
    }
    addListener(routePattern, handler) {
        return this.eventManager.addListener(routePattern, handler);
    }
    dispatch(path, payload) {
        this.href = getPath(path, this.pathProps);
        this.eventManager.dispatch(this.href, payload);
    }
    match(routePattern, path = this.href) {
        return matchPattern(routePattern, path);
    }
    /**
     * Subscribes HTML links to route changes in order to enable history navigation
     * without page reloading.
     *
     * The target can be a selector, or an HTML element, or a collection of HTML elements.
     *
     * @example
     * ```js
     * // subscribing existing and future links
     * route.subscribe('a');
     * ```
     */
    subscribe(target, eventType = 'click') {
        if (typeof window === 'undefined')
            return () => { };
        let handler;
        // `target` is a selector
        if (typeof target === 'string')
            document.addEventListener(eventType, handler = event => {
                let t = event.target.closest(target);
                if (isRouteLink(t)) {
                    event.preventDefault();
                    this.assign(getPath(t.href));
                }
            });
        else if (target instanceof Node)
            target.addEventListener(eventType, handler = event => {
                if (isRouteLink(target)) {
                    event.preventDefault();
                    this.assign(getPath(target.href));
                }
            });
        else if (Array.isArray(target) || target instanceof NodeList || target instanceof HTMLCollection) {
            let unsubscribe = Array.from(target).map(t => this.subscribe(t, eventType));
            return () => unsubscribe.forEach(f => f());
        }
        if (!handler)
            return () => { };
        let id = Math.random().toString(36).slice(2);
        this.subscriptions.push({ eventType, target, handler, id });
        return () => {
            for (let i = this.subscriptions.length - 1; i >= 0; i--) {
                if (this.subscriptions[i].id !== id)
                    continue;
                let { eventType, target, handler } = this.subscriptions[i];
                if (typeof target === 'string')
                    document.removeEventListener(eventType, handler);
                else if (target instanceof Node)
                    target.removeEventListener(eventType, handler);
                this.subscriptions.slice(i, 1);
            }
        };
    }
    /**
     * Adds an entry to the browser's session history
     * (see [`history.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
     * and dispatches a new path event.
     */
    assign(path) {
        if (typeof history !== 'undefined') {
            history.pushState({}, '', path);
            this.dispatch(path);
        }
    }
    /**
     * Replaces the current history entry
     * (see [`history.replaceState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
     * and dispatches a new path event.
     */
    replace(path) {
        if (typeof history !== 'undefined') {
            history.replaceState({}, '', path);
            this.dispatch(path);
        }
    }
    /**
     * Re-dispatches the current path event.
     */
    reload() {
        this.dispatch();
    }
    /*
     * Jumps the specified number of history entries away from the current entry
     * (see [`history.go(delta)`](https://developer.mozilla.org/en-US/docs/Web/API/History/go)
     * and dispatches a new path event (within the `popstate` handler).
     */
    go(delta) {
        if (typeof history !== 'undefined')
            history.go(delta);
    }
    back() {
        this.go(-1);
    }
    forward() {
        this.go(1);
    }
    /**
     * Returns the current full path, same as `.href`.
     */
    toString() {
        return this.href;
    }
}