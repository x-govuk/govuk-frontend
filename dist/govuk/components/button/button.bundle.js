(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('GOVUKFrontend.Button', ['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.GOVUKFrontend = global.GOVUKFrontend || {}, global.GOVUKFrontend.Button = {})));
})(this, (function (exports) { 'use strict';

  /**
   * Common helpers which do not require polyfill.
   *
   * IMPORTANT: If a helper require a polyfill, please isolate it in its own module
   * so that the polyfill can be properly tree-shaken and does not burden
   * the components that do not need that helper
   *
   * @module common/index
   */

  /**
   * Config flattening function
   *
   * Takes any number of objects, flattens them into namespaced key-value pairs,
   * (e.g. \{'i18n.showSection': 'Show section'\}) and combines them together, with
   * greatest priority on the LAST item passed in.
   *
   * @private
   * @returns {{ [key: string]: unknown }} A flattened object of key-value pairs.
   */
  function mergeConfigs( /* configObject1, configObject2, ...configObjects */
  ) {
    /**
     * Function to take nested objects and flatten them to a dot-separated keyed
     * object. Doing this means we don't need to do any deep/recursive merging of
     * each of our objects, nor transform our dataset from a flat list into a
     * nested object.
     *
     * @param {{ [key: string]: unknown }} configObject - Deeply nested object
     * @returns {{ [key: string]: unknown }} Flattened object with dot-separated keys
     */
    const flattenObject = function flattenObject(configObject) {
      // Prepare an empty return object
      /** @type {{ [key: string]: unknown }} */
      const flattenedObject = {};

      /**
       * Our flattening function, this is called recursively for each level of
       * depth in the object. At each level we prepend the previous level names to
       * the key using `prefix`.
       *
       * @param {Partial<{ [key: string]: unknown }>} obj - Object to flatten
       * @param {string} [prefix] - Optional dot-separated prefix
       */
      const flattenLoop = function flattenLoop(obj, prefix) {
        // Loop through keys...
        for (const key in obj) {
          // Check to see if this is a prototypical key/value,
          // if it is, skip it.
          if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            continue;
          }
          const value = obj[key];
          const prefixedKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object') {
            // If the value is a nested object, recurse over that too
            flattenLoop(value, prefixedKey);
          } else {
            // Otherwise, add this value to our return object
            flattenedObject[prefixedKey] = value;
          }
        }
      };

      // Kick off the recursive loop
      flattenLoop(configObject);
      return flattenedObject;
    };

    // Start with an empty object as our base
    /** @type {{ [key: string]: unknown }} */
    const formattedConfigObject = {};

    // Loop through each of the remaining passed objects and push their keys
    // one-by-one into configObject. Any duplicate keys will override the existing
    // key with the new value.
    for (let i = 0; i < arguments.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Ignore mismatch between arguments types
      const obj = flattenObject(arguments[i]);
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          formattedConfigObject[key] = obj[key];
        }
      }
    }
    return formattedConfigObject;
  }

  /**
   * Normalise string
   *
   * 'If it looks like a duck, and it quacks like a duck…' 🦆
   *
   * If the passed value looks like a boolean or a number, convert it to a boolean
   * or number.
   *
   * Designed to be used to convert config passed via data attributes (which are
   * always strings) into something sensible.
   *
   * @private
   * @param {string} value - The value to normalise
   * @returns {string | boolean | number | undefined} Normalised data
   */
  function normaliseString(value) {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmedValue = value.trim();
    if (trimmedValue === 'true') {
      return true;
    }
    if (trimmedValue === 'false') {
      return false;
    }

    // Empty / whitespace-only strings are considered finite so we need to check
    // the length of the trimmed string as well
    if (trimmedValue.length > 0 && isFinite(Number(trimmedValue))) {
      return Number(trimmedValue);
    }
    return value;
  }

  /**
   * Normalise dataset
   *
   * Loop over an object and normalise each value using normaliseData function
   *
   * @private
   * @param {DOMStringMap} dataset - HTML element dataset
   * @returns {{ [key: string]: unknown }} Normalised dataset
   */
  function normaliseDataset(dataset) {
    /** @type {{ [key: string]: unknown }} */
    const out = {};
    for (const key in dataset) {
      out[key] = normaliseString(dataset[key]);
    }
    return out;
  }

  const KEY_SPACE = 32;
  const DEBOUNCE_TIMEOUT_IN_SECONDS = 1;

  /**
   * JavaScript enhancements for the Button component
   */
  class Button {
    /**
     *
     * @param {Element} $module - HTML element to use for button
     * @param {ButtonConfig} [config] - Button config
     */
    constructor($module, config) {
      /** @private */
      this.$module = void 0;
      /**
       * @private
       * @type {ButtonConfig}
       */
      this.config = void 0;
      /**
       * @private
       * @type {number | null}
       */
      this.debounceFormSubmitTimer = null;
      if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
        return this;
      }
      this.$module = $module;
      this.config = mergeConfigs(Button.defaults, config || {}, normaliseDataset($module.dataset));
      this.$module.addEventListener('keydown', event => this.handleKeyDown(event));
      this.$module.addEventListener('click', event => this.debounce(event));
    }

    /**
     * Trigger a click event when the space key is pressed
     *
     * Some screen readers tell users they can activate things with the 'button'
     * role, so we need to match the functionality of native HTML buttons
     *
     * See https://github.com/alphagov/govuk_elements/pull/272#issuecomment-233028270
     *
     * @private
     * @param {KeyboardEvent} event - Keydown event
     */
    handleKeyDown(event) {
      const $target = event.target;

      // Handle space bar only
      if (event.keyCode !== KEY_SPACE) {
        return;
      }

      // Handle elements with [role="button"] only
      if ($target instanceof HTMLElement && $target.getAttribute('role') === 'button') {
        event.preventDefault(); // prevent the page from scrolling
        $target.click();
      }
    }

    /**
     * Debounce double-clicks
     *
     * If the click quickly succeeds a previous click then nothing will happen. This
     * stops people accidentally causing multiple form submissions by double
     * clicking buttons.
     *
     * @private
     * @param {MouseEvent} event - Mouse click event
     * @returns {undefined | false} Returns undefined, or false when debounced
     */
    debounce(event) {
      // Check the button that was clicked has preventDoubleClick enabled
      if (!this.config.preventDoubleClick) {
        return;
      }

      // If the timer is still running, prevent the click from submitting the form
      if (this.debounceFormSubmitTimer) {
        event.preventDefault();
        return false;
      }
      this.debounceFormSubmitTimer = window.setTimeout(() => {
        this.debounceFormSubmitTimer = null;
      }, DEBOUNCE_TIMEOUT_IN_SECONDS * 1000);
    }

    /**
     * Button default config
     *
     * @see {@link ButtonConfig}
     * @constant
     * @default
     * @type {ButtonConfig}
     */
  }

  /**
   * Button config
   *
   * @typedef {object} ButtonConfig
   * @property {boolean} [preventDoubleClick=false] - Prevent accidental double
   *   clicks on submit buttons from submitting forms multiple times.
   */
  Button.defaults = Object.freeze({
    preventDoubleClick: false
  });

  exports.Button = Button;

}));
//# sourceMappingURL=button.bundle.js.map
