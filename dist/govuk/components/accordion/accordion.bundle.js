(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('GOVUKFrontend.Accordion', ['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.GOVUKFrontend = global.GOVUKFrontend || {}, global.GOVUKFrontend.Accordion = {})));
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
   * Extracts keys starting with a particular namespace from a flattened config
   * object, removing the namespace in the process.
   *
   * @private
   * @param {{ [key: string]: unknown }} configObject - The object to extract key-value pairs from.
   * @param {string} namespace - The namespace to filter keys with.
   * @returns {{ [key: string]: unknown }} Flattened object with dot-separated key namespace removed
   * @throws {Error} Config object required
   * @throws {Error} Namespace string required
   */
  function extractConfigByNamespace(configObject, namespace) {
    // Check we have what we need
    if (!configObject || typeof configObject !== 'object') {
      throw new Error('Provide a `configObject` of type "object".');
    }
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('Provide a `namespace` of type "string" to filter the `configObject` by.');
    }

    /** @type {{ [key: string]: unknown }} */
    const newObject = {};
    for (const key in configObject) {
      // Split the key into parts, using . as our namespace separator
      const keyParts = key.split('.');
      // Check if the first namespace matches the configured namespace
      if (Object.prototype.hasOwnProperty.call(configObject, key) && keyParts[0] === namespace) {
        // Remove the first item (the namespace) from the parts array,
        // but only if there is more than one part (we don't want blank keys!)
        if (keyParts.length > 1) {
          keyParts.shift();
        }
        // Join the remaining parts back together
        const newKey = keyParts.join('.');
        // Add them to our new object
        newObject[newKey] = configObject[key];
      }
    }
    return newObject;
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

  /**
   * Internal support for selecting messages to render, with placeholder
   * interpolation and locale-aware number formatting and pluralisation
   *
   * @private
   */
  class I18n {
    /**
     * @param {{ [key: string]: unknown }} translations - Key-value pairs of the translation strings to use.
     * @param {object} [config] - Configuration options for the function.
     * @param {string} [config.locale] - An overriding locale for the PluralRules functionality.
     */
    constructor(translations, config) {
      this.translations = void 0;
      this.locale = void 0;
      // Make list of translations available throughout function
      this.translations = translations || {};

      // The locale to use for PluralRules and NumberFormat
      this.locale = config && config.locale || document.documentElement.lang || 'en';
    }

    /**
     * The most used function - takes the key for a given piece of UI text and
     * returns the appropriate string.
     *
     * @param {string} lookupKey - The lookup key of the string to use.
     * @param {{ [key: string]: unknown }} [options] - Any options passed with the translation string, e.g: for string interpolation.
     * @returns {string} The appropriate translation string.
     * @throws {Error} Lookup key required
     * @throws {Error} Options required for `${}` placeholders
     */
    t(lookupKey, options) {
      if (!lookupKey) {
        // Print a console error if no lookup key has been provided
        throw new Error('i18n: lookup key missing');
      }

      // If the `count` option is set, determine which plural suffix is needed and
      // change the lookupKey to match. We check to see if it's numeric instead of
      // falsy, as this could legitimately be 0.
      if (options && typeof options.count === 'number') {
        // Get the plural suffix
        lookupKey = `${lookupKey}.${this.getPluralSuffix(lookupKey, options.count)}`;
      }

      // Fetch the translation string for that lookup key
      const translationString = this.translations[lookupKey];
      if (typeof translationString === 'string') {
        // Check for ${} placeholders in the translation string
        if (translationString.match(/%{(.\S+)}/)) {
          if (!options) {
            throw new Error('i18n: cannot replace placeholders in string if no option data provided');
          }
          return this.replacePlaceholders(translationString, options);
        } else {
          return translationString;
        }
      } else {
        // If the key wasn't found in our translations object,
        // return the lookup key itself as the fallback
        return lookupKey;
      }
    }

    /**
     * Takes a translation string with placeholders, and replaces the placeholders
     * with the provided data
     *
     * @param {string} translationString - The translation string
     * @param {{ [key: string]: unknown }} options - Any options passed with the translation string, e.g: for string interpolation.
     * @returns {string} The translation string to output, with $\{\} placeholders replaced
     */
    replacePlaceholders(translationString, options) {
      /** @type {Intl.NumberFormat | undefined} */
      let formatter;
      if (this.hasIntlNumberFormatSupport()) {
        formatter = new Intl.NumberFormat(this.locale);
      }
      return translationString.replace(/%{(.\S+)}/g,
      /**
       * Replace translation string placeholders
       *
       * @param {string} placeholderWithBraces - Placeholder with braces
       * @param {string} placeholderKey - Placeholder key
       * @returns {string} Placeholder value
       */
      function (placeholderWithBraces, placeholderKey) {
        if (Object.prototype.hasOwnProperty.call(options, placeholderKey)) {
          const placeholderValue = options[placeholderKey];

          // If a user has passed `false` as the value for the placeholder
          // treat it as though the value should not be displayed
          if (placeholderValue === false || typeof placeholderValue !== 'number' && typeof placeholderValue !== 'string') {
            return '';
          }

          // If the placeholder's value is a number, localise the number formatting
          if (typeof placeholderValue === 'number') {
            return formatter ? formatter.format(placeholderValue) : `${placeholderValue}`;
          }
          return placeholderValue;
        } else {
          throw new Error(`i18n: no data found to replace ${placeholderWithBraces} placeholder in string`);
        }
      });
    }

    /**
     * Check to see if the browser supports Intl and Intl.PluralRules.
     *
     * It requires all conditions to be met in order to be supported:
     * - The browser supports the Intl class (true in IE11)
     * - The implementation of Intl supports PluralRules (NOT true in IE11)
     * - The browser/OS has plural rules for the current locale (browser dependent)
     *
     * @returns {boolean} Returns true if all conditions are met. Returns false otherwise.
     */
    hasIntlPluralRulesSupport() {
      return Boolean(window.Intl && 'PluralRules' in window.Intl && Intl.PluralRules.supportedLocalesOf(this.locale).length);
    }

    /**
     * Check to see if the browser supports Intl and Intl.NumberFormat.
     *
     * It requires all conditions to be met in order to be supported:
     * - The browser supports the Intl class (true in IE11)
     * - The implementation of Intl supports NumberFormat (also true in IE11)
     * - The browser/OS has number formatting rules for the current locale (browser dependent)
     *
     * @returns {boolean} Returns true if all conditions are met. Returns false otherwise.
     */
    hasIntlNumberFormatSupport() {
      return Boolean(window.Intl && 'NumberFormat' in window.Intl && Intl.NumberFormat.supportedLocalesOf(this.locale).length);
    }

    /**
     * Get the appropriate suffix for the plural form.
     *
     * Uses Intl.PluralRules (or our own fallback implementation) to get the
     * 'preferred' form to use for the given count.
     *
     * Checks that a translation has been provided for that plural form – if it
     * hasn't, it'll fall back to the 'other' plural form (unless that doesn't exist
     * either, in which case an error will be thrown)
     *
     * @param {string} lookupKey - The lookup key of the string to use.
     * @param {number} count - Number used to determine which pluralisation to use.
     * @returns {PluralRule} The suffix associated with the correct pluralisation for this locale.
     * @throws {Error} Plural form `.other` required when preferred plural form is missing
     */
    getPluralSuffix(lookupKey, count) {
      // Validate that the number is actually a number.
      //
      // Number(count) will turn anything that can't be converted to a Number type
      // into 'NaN'. isFinite filters out NaN, as it isn't a finite number.
      count = Number(count);
      if (!isFinite(count)) {
        return 'other';
      }
      let preferredForm;

      // Check to verify that all the requirements for Intl.PluralRules are met.
      // If so, we can use that instead of our custom implementation. Otherwise,
      // use the hardcoded fallback.
      if (this.hasIntlPluralRulesSupport()) {
        preferredForm = new Intl.PluralRules(this.locale).select(count);
      } else {
        preferredForm = this.selectPluralFormUsingFallbackRules(count);
      }

      // Use the correct plural form if provided
      if (`${lookupKey}.${preferredForm}` in this.translations) {
        return preferredForm;
        // Fall back to `other` if the plural form is missing, but log a warning
        // to the console
      } else if (`${lookupKey}.other` in this.translations) {
        if (console && 'warn' in console) {
          console.warn(`i18n: Missing plural form ".${preferredForm}" for "${this.locale}" locale. Falling back to ".other".`);
        }
        return 'other';
        // If the required `other` plural form is missing, all we can do is error
      } else {
        throw new Error(`i18n: Plural form ".other" is required for "${this.locale}" locale`);
      }
    }

    /**
     * Get the plural form using our fallback implementation
     *
     * This is split out into a separate function to make it easier to test the
     * fallback behaviour in an environment where Intl.PluralRules exists.
     *
     * @param {number} count - Number used to determine which pluralisation to use.
     * @returns {PluralRule} The pluralisation form for count in this locale.
     */
    selectPluralFormUsingFallbackRules(count) {
      // Currently our custom code can only handle positive integers, so let's
      // make sure our number is one of those.
      count = Math.abs(Math.floor(count));
      const ruleset = this.getPluralRulesForLocale();
      if (ruleset) {
        return I18n.pluralRules[ruleset](count);
      }
      return 'other';
    }

    /**
     * Work out which pluralisation rules to use for the current locale
     *
     * The locale may include a regional indicator (such as en-GB), but we don't
     * usually care about this part, as pluralisation rules are usually the same
     * regardless of region. There are exceptions, however, (e.g. Portuguese) so
     * this searches by both the full and shortened locale codes, just to be sure.
     *
     * @returns {string | undefined} The name of the pluralisation rule to use (a key for one
     *   of the functions in this.pluralRules)
     */
    getPluralRulesForLocale() {
      const locale = this.locale;
      const localeShort = locale.split('-')[0];

      // Look through the plural rules map to find which `pluralRule` is
      // appropriate for our current `locale`.
      for (const pluralRule in I18n.pluralRulesMap) {
        if (Object.prototype.hasOwnProperty.call(I18n.pluralRulesMap, pluralRule)) {
          const languages = I18n.pluralRulesMap[pluralRule];
          for (let i = 0; i < languages.length; i++) {
            if (languages[i] === locale || languages[i] === localeShort) {
              return pluralRule;
            }
          }
        }
      }
    }

    /**
     * Map of plural rules to languages where those rules apply.
     *
     * Note: These groups are named for the most dominant or recognisable language
     * that uses each system. The groupings do not imply that the languages are
     * related to one another. Many languages have evolved the same systems
     * independently of one another.
     *
     * Code to support more languages can be found in the i18n spike:
     * {@link https://github.com/alphagov/govuk-frontend/blob/spike-i18n-support/src/govuk/i18n.mjs}
     *
     * Languages currently supported:
     *
     * Arabic: Arabic (ar)
     * Chinese: Burmese (my), Chinese (zh), Indonesian (id), Japanese (ja),
     *   Javanese (jv), Korean (ko), Malay (ms), Thai (th), Vietnamese (vi)
     * French: Armenian (hy), Bangla (bn), French (fr), Gujarati (gu), Hindi (hi),
     *   Persian Farsi (fa), Punjabi (pa), Zulu (zu)
     * German: Afrikaans (af), Albanian (sq), Azerbaijani (az), Basque (eu),
     *   Bulgarian (bg), Catalan (ca), Danish (da), Dutch (nl), English (en),
     *   Estonian (et), Finnish (fi), Georgian (ka), German (de), Greek (el),
     *   Hungarian (hu), Luxembourgish (lb), Norwegian (no), Somali (so),
     *   Swahili (sw), Swedish (sv), Tamil (ta), Telugu (te), Turkish (tr),
     *   Urdu (ur)
     * Irish: Irish Gaelic (ga)
     * Russian: Russian (ru), Ukrainian (uk)
     * Scottish: Scottish Gaelic (gd)
     * Spanish: European Portuguese (pt-PT), Italian (it), Spanish (es)
     * Welsh: Welsh (cy)
     *
     * @type {{ [key: string]: string[] }}
     */
  }

  /**
   * Plural rule category mnemonic tags
   *
   * @typedef {'zero' | 'one' | 'two' | 'few' | 'many' | 'other'} PluralRule
   */

  /**
   * Translated message by plural rule they correspond to.
   *
   * Allows to group pluralised messages under a single key when passing
   * translations to a component's constructor
   *
   * @typedef {object} TranslationPluralForms
   * @property {string} [other] - General plural form
   * @property {string} [zero] - Plural form used with 0
   * @property {string} [one] - Plural form used with 1
   * @property {string} [two] - Plural form used with 2
   * @property {string} [few] - Plural form used for a few
   * @property {string} [many] - Plural form used for many
   */
  I18n.pluralRulesMap = {
    arabic: ['ar'],
    chinese: ['my', 'zh', 'id', 'ja', 'jv', 'ko', 'ms', 'th', 'vi'],
    french: ['hy', 'bn', 'fr', 'gu', 'hi', 'fa', 'pa', 'zu'],
    german: ['af', 'sq', 'az', 'eu', 'bg', 'ca', 'da', 'nl', 'en', 'et', 'fi', 'ka', 'de', 'el', 'hu', 'lb', 'no', 'so', 'sw', 'sv', 'ta', 'te', 'tr', 'ur'],
    irish: ['ga'],
    russian: ['ru', 'uk'],
    scottish: ['gd'],
    spanish: ['pt-PT', 'it', 'es'],
    welsh: ['cy']
  };
  /**
   * Different pluralisation rule sets
   *
   * Returns the appropriate suffix for the plural form associated with `n`.
   * Possible suffixes: 'zero', 'one', 'two', 'few', 'many', 'other' (the actual
   * meaning of each differs per locale). 'other' should always exist, even in
   * languages without plurals, such as Chinese.
   * {@link https://cldr.unicode.org/index/cldr-spec/plural-rules}
   *
   * The count must be a positive integer. Negative numbers and decimals aren't accounted for
   *
   * @type {{ [key: string]: (count: number) => PluralRule }}
   */
  I18n.pluralRules = {
    /* eslint-disable jsdoc/require-jsdoc */
    arabic(n) {
      if (n === 0) {
        return 'zero';
      }
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n % 100 >= 3 && n % 100 <= 10) {
        return 'few';
      }
      if (n % 100 >= 11 && n % 100 <= 99) {
        return 'many';
      }
      return 'other';
    },
    chinese() {
      return 'other';
    },
    french(n) {
      return n === 0 || n === 1 ? 'one' : 'other';
    },
    german(n) {
      return n === 1 ? 'one' : 'other';
    },
    irish(n) {
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n >= 3 && n <= 6) {
        return 'few';
      }
      if (n >= 7 && n <= 10) {
        return 'many';
      }
      return 'other';
    },
    russian(n) {
      const lastTwo = n % 100;
      const last = lastTwo % 10;
      if (last === 1 && lastTwo !== 11) {
        return 'one';
      }
      if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
        return 'few';
      }
      if (last === 0 || last >= 5 && last <= 9 || lastTwo >= 11 && lastTwo <= 14) {
        return 'many';
      }
      // Note: The 'other' suffix is only used by decimal numbers in Russian.
      // We don't anticipate it being used, but it's here for consistency.
      return 'other';
    },
    scottish(n) {
      if (n === 1 || n === 11) {
        return 'one';
      }
      if (n === 2 || n === 12) {
        return 'two';
      }
      if (n >= 3 && n <= 10 || n >= 13 && n <= 19) {
        return 'few';
      }
      return 'other';
    },
    spanish(n) {
      if (n === 1) {
        return 'one';
      }
      if (n % 1000000 === 0 && n !== 0) {
        return 'many';
      }
      return 'other';
    },
    welsh(n) {
      if (n === 0) {
        return 'zero';
      }
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 3) {
        return 'few';
      }
      if (n === 6) {
        return 'many';
      }
      return 'other';
    }
    /* eslint-enable jsdoc/require-jsdoc */
  };

  /**
   * Accordion component
   *
   * This allows a collection of sections to be collapsed by default, showing only
   * their headers. Sections can be expanded or collapsed individually by clicking
   * their headers. A "Show all sections" button is also added to the top of the
   * accordion, which switches to "Hide all sections" when all the sections are
   * expanded.
   *
   * The state of each section is saved to the DOM via the `aria-expanded`
   * attribute, which also provides accessibility.
   */
  class Accordion {
    /**
     * @param {Element} $module - HTML element to use for accordion
     * @param {AccordionConfig} [config] - Accordion config
     */
    constructor($module, config) {
      /** @private */
      this.$module = void 0;
      /**
       * @private
       * @type {AccordionConfig}
       */
      this.config = void 0;
      /** @private */
      this.i18n = void 0;
      /** @private */
      this.controlsClass = 'govuk-accordion__controls';
      /** @private */
      this.showAllClass = 'govuk-accordion__show-all';
      /** @private */
      this.showAllTextClass = 'govuk-accordion__show-all-text';
      /** @private */
      this.sectionClass = 'govuk-accordion__section';
      /** @private */
      this.sectionExpandedClass = 'govuk-accordion__section--expanded';
      /** @private */
      this.sectionButtonClass = 'govuk-accordion__section-button';
      /** @private */
      this.sectionHeaderClass = 'govuk-accordion__section-header';
      /** @private */
      this.sectionHeadingClass = 'govuk-accordion__section-heading';
      /** @private */
      this.sectionHeadingDividerClass = 'govuk-accordion__section-heading-divider';
      /** @private */
      this.sectionHeadingTextClass = 'govuk-accordion__section-heading-text';
      /** @private */
      this.sectionHeadingTextFocusClass = 'govuk-accordion__section-heading-text-focus';
      /** @private */
      this.sectionShowHideToggleClass = 'govuk-accordion__section-toggle';
      /** @private */
      this.sectionShowHideToggleFocusClass = 'govuk-accordion__section-toggle-focus';
      /** @private */
      this.sectionShowHideTextClass = 'govuk-accordion__section-toggle-text';
      /** @private */
      this.upChevronIconClass = 'govuk-accordion-nav__chevron';
      /** @private */
      this.downChevronIconClass = 'govuk-accordion-nav__chevron--down';
      /** @private */
      this.sectionSummaryClass = 'govuk-accordion__section-summary';
      /** @private */
      this.sectionSummaryFocusClass = 'govuk-accordion__section-summary-focus';
      /** @private */
      this.sectionContentClass = 'govuk-accordion__section-content';
      /** @private */
      this.$sections = void 0;
      /** @private */
      this.browserSupportsSessionStorage = false;
      /**
       * @private
       * @type {HTMLButtonElement | null}
       */
      this.$showAllButton = null;
      /**
       * @private
       * @type {HTMLElement | null}
       */
      this.$showAllIcon = null;
      /**
       * @private
       * @type {HTMLElement | null}
       */
      this.$showAllText = null;
      if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
        return this;
      }
      this.$module = $module;
      this.config = mergeConfigs(Accordion.defaults, config || {}, normaliseDataset($module.dataset));
      this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'));
      const $sections = this.$module.querySelectorAll(`.${this.sectionClass}`);
      if (!$sections.length) {
        return this;
      }
      this.$sections = $sections;
      this.browserSupportsSessionStorage = helper.checkForSessionStorage();
      this.initControls();
      this.initSectionHeaders();

      // See if "Show all sections" button text should be updated
      const areAllSectionsOpen = this.checkIfAllSectionsOpen();
      this.updateShowAllButton(areAllSectionsOpen);
    }

    /**
     * Initialise controls and set attributes
     *
     * @private
     */
    initControls() {
      // Create "Show all" button and set attributes
      this.$showAllButton = document.createElement('button');
      this.$showAllButton.setAttribute('type', 'button');
      this.$showAllButton.setAttribute('class', this.showAllClass);
      this.$showAllButton.setAttribute('aria-expanded', 'false');

      // Create icon, add to element
      this.$showAllIcon = document.createElement('span');
      this.$showAllIcon.classList.add(this.upChevronIconClass);
      this.$showAllButton.appendChild(this.$showAllIcon);

      // Create control wrapper and add controls to it
      const $accordionControls = document.createElement('div');
      $accordionControls.setAttribute('class', this.controlsClass);
      $accordionControls.appendChild(this.$showAllButton);
      this.$module.insertBefore($accordionControls, this.$module.firstChild);

      // Build additional wrapper for Show all toggle text and place after icon
      this.$showAllText = document.createElement('span');
      this.$showAllText.classList.add(this.showAllTextClass);
      this.$showAllButton.appendChild(this.$showAllText);

      // Handle click events on the show/hide all button
      this.$showAllButton.addEventListener('click', () => this.onShowOrHideAllToggle());

      // Handle 'beforematch' events, if the user agent supports them
      if ('onbeforematch' in document) {
        document.addEventListener('beforematch', event => this.onBeforeMatch(event));
      }
    }

    /**
     * Initialise section headers
     *
     * @private
     */
    initSectionHeaders() {
      // Loop through sections
      this.$sections.forEach(($section, i) => {
        const $header = $section.querySelector(`.${this.sectionHeaderClass}`);
        if (!$header) {
          return;
        }

        // Set header attributes
        this.constructHeaderMarkup($header, i);
        this.setExpanded(this.isExpanded($section), $section);

        // Handle events
        $header.addEventListener('click', () => this.onSectionToggle($section));

        // See if there is any state stored in sessionStorage and set the sections to
        // open or closed.
        this.setInitialState($section);
      });
    }

    /**
     * Construct section header
     *
     * @private
     * @param {Element} $header - Section header
     * @param {number} index - Section index
     */
    constructHeaderMarkup($header, index) {
      const $span = $header.querySelector(`.${this.sectionButtonClass}`);
      const $heading = $header.querySelector(`.${this.sectionHeadingClass}`);
      const $summary = $header.querySelector(`.${this.sectionSummaryClass}`);
      if (!$span || !$heading) {
        return;
      }

      // Create a button element that will replace the '.govuk-accordion__section-button' span
      const $button = document.createElement('button');
      $button.setAttribute('type', 'button');
      $button.setAttribute('aria-controls', `${this.$module.id}-content-${index + 1}`);

      // Copy all attributes (https://developer.mozilla.org/en-US/docs/Web/API/Element/attributes) from $span to $button
      for (let i = 0; i < $span.attributes.length; i++) {
        const attr = $span.attributes.item(i);
        // Add all attributes but not ID as this is being added to
        // the section heading ($headingText)
        if (attr.nodeName !== 'id') {
          $button.setAttribute(attr.nodeName, attr.nodeValue);
        }
      }

      // Create container for heading text so it can be styled
      const $headingText = document.createElement('span');
      $headingText.classList.add(this.sectionHeadingTextClass);
      // Copy the span ID to the heading text to allow it to be referenced by `aria-labelledby` on the
      // hidden content area without "Show this section"
      $headingText.id = $span.id;

      // Create an inner heading text container to limit the width of the focus state
      const $headingTextFocus = document.createElement('span');
      $headingTextFocus.classList.add(this.sectionHeadingTextFocusClass);
      $headingText.appendChild($headingTextFocus);
      // span could contain HTML elements (see https://www.w3.org/TR/2011/WD-html5-20110525/content-models.html#phrasing-content)
      $headingTextFocus.innerHTML = $span.innerHTML;

      // Create container for show / hide icons and text.
      const $showHideToggle = document.createElement('span');
      $showHideToggle.classList.add(this.sectionShowHideToggleClass);
      // Tell Google not to index the 'show' text as part of the heading
      // For the snippet to work with JavaScript, it must be added before adding the page element to the
      // page's DOM. See https://developers.google.com/search/docs/advanced/robots/robots_meta_tag#data-nosnippet-attr
      $showHideToggle.setAttribute('data-nosnippet', '');
      // Create an inner container to limit the width of the focus state
      const $showHideToggleFocus = document.createElement('span');
      $showHideToggleFocus.classList.add(this.sectionShowHideToggleFocusClass);
      $showHideToggle.appendChild($showHideToggleFocus);
      // Create wrapper for the show / hide text. Append text after the show/hide icon
      const $showHideText = document.createElement('span');
      const $showHideIcon = document.createElement('span');
      $showHideIcon.classList.add(this.upChevronIconClass);
      $showHideToggleFocus.appendChild($showHideIcon);
      $showHideText.classList.add(this.sectionShowHideTextClass);
      $showHideToggleFocus.appendChild($showHideText);

      // Append elements to the button:
      // 1. Heading text
      // 2. Punctuation
      // 3. (Optional: Summary line followed by punctuation)
      // 4. Show / hide toggle
      $button.appendChild($headingText);
      $button.appendChild(this.getButtonPunctuationEl());

      // If summary content exists add to DOM in correct order
      if ($summary) {
        // Create a new `span` element and copy the summary line content from the original `div` to the
        // new `span`
        // This is because the summary line text is now inside a button element, which can only contain
        // phrasing content
        const $summarySpan = document.createElement('span');
        // Create an inner summary container to limit the width of the summary focus state
        const $summarySpanFocus = document.createElement('span');
        $summarySpanFocus.classList.add(this.sectionSummaryFocusClass);
        $summarySpan.appendChild($summarySpanFocus);

        // Get original attributes, and pass them to the replacement
        for (let j = 0, l = $summary.attributes.length; j < l; ++j) {
          const nodeName = $summary.attributes.item(j).nodeName;
          const nodeValue = $summary.attributes.item(j).nodeValue;
          $summarySpan.setAttribute(nodeName, nodeValue);
        }

        // Copy original contents of summary to the new summary span
        $summarySpanFocus.innerHTML = $summary.innerHTML;

        // Replace the original summary `div` with the new summary `span`
        $summary.parentNode.replaceChild($summarySpan, $summary);
        $button.appendChild($summarySpan);
        $button.appendChild(this.getButtonPunctuationEl());
      }
      $button.appendChild($showHideToggle);
      $heading.removeChild($span);
      $heading.appendChild($button);
    }

    /**
     * When a section is opened by the user agent via the 'beforematch' event
     *
     * @private
     * @param {Event} event - Generic event
     */
    onBeforeMatch(event) {
      const $fragment = event.target;

      // Handle elements with `.closest()` support only
      if (!($fragment instanceof Element)) {
        return;
      }

      // Handle when fragment is inside section
      const $section = $fragment.closest(`.${this.sectionClass}`);
      if ($section) {
        this.setExpanded(true, $section);
      }
    }

    /**
     * When section toggled, set and store state
     *
     * @private
     * @param {Element} $section - Section element
     */
    onSectionToggle($section) {
      const expanded = this.isExpanded($section);
      this.setExpanded(!expanded, $section);

      // Store the state in sessionStorage when a change is triggered
      this.storeState($section);
    }

    /**
     * When Open/Close All toggled, set and store state
     *
     * @private
     */
    onShowOrHideAllToggle() {
      const nowExpanded = !this.checkIfAllSectionsOpen();

      // Loop through sections
      this.$sections.forEach($section => {
        this.setExpanded(nowExpanded, $section);
        // Store the state in sessionStorage when a change is triggered
        this.storeState($section);
      });
      this.updateShowAllButton(nowExpanded);
    }

    /**
     * Set section attributes when opened/closed
     *
     * @private
     * @param {boolean} expanded - Section expanded
     * @param {Element} $section - Section element
     */
    setExpanded(expanded, $section) {
      const $showHideIcon = $section.querySelector(`.${this.upChevronIconClass}`);
      const $showHideText = $section.querySelector(`.${this.sectionShowHideTextClass}`);
      const $button = $section.querySelector(`.${this.sectionButtonClass}`);
      const $content = $section.querySelector(`.${this.sectionContentClass}`);
      if (!$showHideIcon || !($showHideText instanceof HTMLElement) || !$button || !$content) {
        return;
      }
      const newButtonText = expanded ? this.i18n.t('hideSection') : this.i18n.t('showSection');
      $showHideText.innerText = newButtonText;
      $button.setAttribute('aria-expanded', `${expanded}`);

      // Update aria-label combining
      const ariaLabelParts = [];
      const $headingText = $section.querySelector(`.${this.sectionHeadingTextClass}`);
      if ($headingText instanceof HTMLElement) {
        ariaLabelParts.push($headingText.innerText.trim());
      }
      const $summary = $section.querySelector(`.${this.sectionSummaryClass}`);
      if ($summary instanceof HTMLElement) {
        ariaLabelParts.push($summary.innerText.trim());
      }
      const ariaLabelMessage = expanded ? this.i18n.t('hideSectionAriaLabel') : this.i18n.t('showSectionAriaLabel');
      ariaLabelParts.push(ariaLabelMessage);

      /*
       * Join with a comma to add pause for assistive technology.
       * Example: [heading]Section A ,[pause] Show this section.
       * https://accessibility.blog.gov.uk/2017/12/18/what-working-on-gov-uk-navigation-taught-us-about-accessibility/
       */
      $button.setAttribute('aria-label', ariaLabelParts.join(' , '));

      // Swap icon, change class
      if (expanded) {
        $content.removeAttribute('hidden');
        $section.classList.add(this.sectionExpandedClass);
        $showHideIcon.classList.remove(this.downChevronIconClass);
      } else {
        $content.setAttribute('hidden', 'until-found');
        $section.classList.remove(this.sectionExpandedClass);
        $showHideIcon.classList.add(this.downChevronIconClass);
      }

      // See if "Show all sections" button text should be updated
      const areAllSectionsOpen = this.checkIfAllSectionsOpen();
      this.updateShowAllButton(areAllSectionsOpen);
    }

    /**
     * Get state of section
     *
     * @private
     * @param {Element} $section - Section element
     * @returns {boolean} True if expanded
     */
    isExpanded($section) {
      return $section.classList.contains(this.sectionExpandedClass);
    }

    /**
     * Check if all sections are open
     *
     * @private
     * @returns {boolean} True if all sections are open
     */
    checkIfAllSectionsOpen() {
      // Get a count of all the Accordion sections
      const sectionsCount = this.$sections.length;
      // Get a count of all Accordion sections that are expanded
      const expandedSectionCount = this.$module.querySelectorAll(`.${this.sectionExpandedClass}`).length;
      const areAllSectionsOpen = sectionsCount === expandedSectionCount;
      return areAllSectionsOpen;
    }

    /**
     * Update "Show all sections" button
     *
     * @private
     * @param {boolean} expanded - Section expanded
     */
    updateShowAllButton(expanded) {
      const newButtonText = expanded ? this.i18n.t('hideAllSections') : this.i18n.t('showAllSections');
      this.$showAllButton.setAttribute('aria-expanded', expanded.toString());
      this.$showAllText.innerText = newButtonText;

      // Swap icon, toggle class
      if (expanded) {
        this.$showAllIcon.classList.remove(this.downChevronIconClass);
      } else {
        this.$showAllIcon.classList.add(this.downChevronIconClass);
      }
    }

    /**
     * Set the state of the accordions in sessionStorage
     *
     * @private
     * @param {Element} $section - Section element
     */
    storeState($section) {
      if (this.browserSupportsSessionStorage && this.config.rememberExpanded) {
        // We need a unique way of identifying each content in the Accordion. Since
        // an `#id` should be unique and an `id` is required for `aria-` attributes
        // `id` can be safely used.
        const $button = $section.querySelector(`.${this.sectionButtonClass}`);
        if ($button) {
          const contentId = $button.getAttribute('aria-controls');
          const contentState = $button.getAttribute('aria-expanded');

          // Only set the state when both `contentId` and `contentState` are taken from the DOM.
          if (contentId && contentState) {
            window.sessionStorage.setItem(contentId, contentState);
          }
        }
      }
    }

    /**
     * Read the state of the accordions from sessionStorage
     *
     * @private
     * @param {Element} $section - Section element
     */
    setInitialState($section) {
      if (this.browserSupportsSessionStorage && this.config.rememberExpanded) {
        const $button = $section.querySelector(`.${this.sectionButtonClass}`);
        if ($button) {
          const contentId = $button.getAttribute('aria-controls');
          const contentState = contentId ? window.sessionStorage.getItem(contentId) : null;
          if (contentState !== null) {
            this.setExpanded(contentState === 'true', $section);
          }
        }
      }
    }

    /**
     * Create an element to improve semantics of the section button with punctuation
     *
     * Adding punctuation to the button can also improve its general semantics by dividing its contents
     * into thematic chunks.
     * See https://github.com/alphagov/govuk-frontend/issues/2327#issuecomment-922957442
     *
     * @private
     * @returns {Element} DOM element
     */
    getButtonPunctuationEl() {
      const $punctuationEl = document.createElement('span');
      $punctuationEl.classList.add('govuk-visually-hidden', this.sectionHeadingDividerClass);
      $punctuationEl.innerHTML = ', ';
      return $punctuationEl;
    }

    /**
     * Accordion default config
     *
     * @see {@link AccordionConfig}
     * @constant
     * @default
     * @type {AccordionConfig}
     */
  }
  Accordion.defaults = Object.freeze({
    i18n: {
      hideAllSections: 'Hide all sections',
      hideSection: 'Hide',
      hideSectionAriaLabel: 'Hide this section',
      showAllSections: 'Show all sections',
      showSection: 'Show',
      showSectionAriaLabel: 'Show this section'
    },
    rememberExpanded: true
  });
  const helper = {
    /**
     * Check for `window.sessionStorage`, and that it actually works.
     *
     * @returns {boolean} True if session storage is available
     */
    checkForSessionStorage: function () {
      const testString = 'this is the test string';
      let result;
      try {
        window.sessionStorage.setItem(testString, testString);
        result = window.sessionStorage.getItem(testString) === testString.toString();
        window.sessionStorage.removeItem(testString);
        return result;
      } catch (exception) {
        return false;
      }
    }
  };

  /**
   * Accordion config
   *
   * @see {@link Accordion.defaults}
   * @typedef {object} AccordionConfig
   * @property {AccordionTranslations} [i18n=Accordion.defaults.i18n] - Accordion translations
   * @property {boolean} [rememberExpanded] - Whether the expanded and collapsed
   *   state of each section is remembered and restored when navigating.
   */

  /**
   * Accordion translations
   *
   * @see {@link Accordion.defaults.i18n}
   * @typedef {object} AccordionTranslations
   *
   * Messages used by the component for the labels of its buttons. This includes
   * the visible text shown on screen, and text to help assistive technology users
   * for the buttons toggling each section.
   * @property {string} [hideAllSections] - The text content for the 'Hide all
   *   sections' button, used when at least one section is expanded.
   * @property {string} [hideSection] - The text content for the 'Hide'
   *   button, used when a section is expanded.
   * @property {string} [hideSectionAriaLabel] - The text content appended to the
   *   'Hide' button's accessible name when a section is expanded.
   * @property {string} [showAllSections] - The text content for the 'Show all
   *   sections' button, used when all sections are collapsed.
   * @property {string} [showSection] - The text content for the 'Show'
   *   button, used when a section is collapsed.
   * @property {string} [showSectionAriaLabel] - The text content appended to the
   *   'Show' button's accessible name when a section is expanded.
   */

  exports.Accordion = Accordion;

}));
//# sourceMappingURL=accordion.bundle.js.map
