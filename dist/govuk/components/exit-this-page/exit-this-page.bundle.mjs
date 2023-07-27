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
 * Exit This Page component
 */
class ExitThisPage {
  /**
   * @param {Element} $module - HTML element that wraps the Exit This Page button
   * @param {ExitThisPageConfig} [config] - Exit This Page config
   */
  constructor($module, config) {
    /** @private */
    this.$module = void 0;
    /**
     * @private
     * @type {ExitThisPageConfig}
     */
    this.config = void 0;
    /** @private */
    this.i18n = void 0;
    /** @private */
    this.$button = void 0;
    /**
     * @private
     * @type {HTMLAnchorElement | null}
     */
    this.$skiplinkButton = null;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$updateSpan = null;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$indicatorContainer = null;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$overlay = null;
    /** @private */
    this.keypressCounter = 0;
    /** @private */
    this.lastKeyWasModified = false;
    /** @private */
    this.timeoutTime = 5000;
    // milliseconds
    // Store the timeout events so that we can clear them to avoid user keypresses overlapping
    // setTimeout returns an id that we can use to clear it with clearTimeout,
    // hence the 'Id' suffix
    /**
     * @private
     * @type {number | null}
     */
    this.keypressTimeoutId = null;
    /**
     * @private
     * @type {number | null}
     */
    this.timeoutMessageId = null;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    const $button = $module.querySelector('.govuk-exit-this-page__button');
    if (!($button instanceof HTMLElement)) {
      return this;
    }
    this.config = mergeConfigs(ExitThisPage.defaults, config || {}, normaliseDataset($module.dataset));
    this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'));
    this.$module = $module;
    this.$button = $button;
    const $skiplinkButton = document.querySelector('.govuk-js-exit-this-page-skiplink');
    if ($skiplinkButton instanceof HTMLAnchorElement) {
      this.$skiplinkButton = $skiplinkButton;
    }
    this.buildIndicator();
    this.initUpdateSpan();
    this.initButtonClickHandler();

    // Check to see if this has already been done by a previous initialisation of ExitThisPage
    if (!('govukFrontendExitThisPageKeypress' in document.body.dataset)) {
      document.addEventListener('keyup', this.handleKeypress.bind(this), true);
      document.body.dataset.govukFrontendExitThisPageKeypress = 'true';
    }

    // When the page is restored after navigating 'back' in some browsers the
    // blank overlay remains present, rendering the page unusable. Here, we check
    // to see if it's present on page (re)load, and remove it if so.
    window.addEventListener('pageshow', this.resetPage.bind(this));
  }

  /**
   * Create the <span> we use for screen reader announcements.
   *
   * @private
   */
  initUpdateSpan() {
    this.$updateSpan = document.createElement('span');
    this.$updateSpan.setAttribute('role', 'status');
    this.$updateSpan.className = 'govuk-visually-hidden';
    this.$module.appendChild(this.$updateSpan);
  }

  /**
   * Create button click handlers.
   *
   * @private
   */
  initButtonClickHandler() {
    // Main EtP button
    this.$button.addEventListener('click', this.handleClick.bind(this));

    // EtP secondary link
    if (this.$skiplinkButton) {
      this.$skiplinkButton.addEventListener('click', this.handleClick.bind(this));
    }
  }

  /**
   * Create the HTML for the 'three lights' indicator on the button.
   *
   * @private
   */
  buildIndicator() {
    // Build container
    // Putting `aria-hidden` on it as it won't contain any readable information
    this.$indicatorContainer = document.createElement('div');
    this.$indicatorContainer.className = 'govuk-exit-this-page__indicator';
    this.$indicatorContainer.setAttribute('aria-hidden', 'true');

    // Create three 'lights' and place them within the container
    for (let i = 0; i < 3; i++) {
      const $indicator = document.createElement('div');
      $indicator.className = 'govuk-exit-this-page__indicator-light';
      this.$indicatorContainer.appendChild($indicator);
    }

    // Append it all to the module
    this.$button.appendChild(this.$indicatorContainer);
  }

  /**
   * Update whether the lights are visible and which ones are lit up depending on
   * the value of `keypressCounter`.
   *
   * @private
   */
  updateIndicator() {
    // Show or hide the indicator container depending on keypressCounter value
    if (this.keypressCounter > 0) {
      this.$indicatorContainer.classList.add('govuk-exit-this-page__indicator--visible');
    } else {
      this.$indicatorContainer.classList.remove('govuk-exit-this-page__indicator--visible');
    }

    // Turn on only the indicators we want on
    const $indicators = this.$indicatorContainer.querySelectorAll('.govuk-exit-this-page__indicator-light');
    $indicators.forEach(($indicator, index) => {
      $indicator.classList.toggle('govuk-exit-this-page__indicator-light--on', index < this.keypressCounter);
    });
  }

  /**
   * Initiates the redirection away from the current page.
   * Includes the loading overlay functionality, which covers the current page with a
   * white overlay so that the contents are not visible during the loading
   * process. This is particularly important on slow network connections.
   *
   * @private
   */
  exitPage() {
    this.$updateSpan.innerText = '';

    // Blank the page
    // As well as creating an overlay with text, we also set the body to hidden
    // to prevent screen reader and sequential navigation users potentially
    // navigating through the page behind the overlay during loading
    document.body.classList.add('govuk-exit-this-page-hide-content');
    this.$overlay = document.createElement('div');
    this.$overlay.className = 'govuk-exit-this-page-overlay';
    this.$overlay.setAttribute('role', 'alert');

    // we do these this way round, thus incurring a second paint, because changing
    // the element text after adding it means that screen readers pick up the
    // announcement more reliably.
    document.body.appendChild(this.$overlay);
    this.$overlay.innerText = this.i18n.t('activated');
    window.location.href = this.$button.getAttribute('href');
  }

  /**
   * Pre-activation logic for when the button is clicked/activated via mouse or
   * pointer.
   *
   * We do this to differentiate it from the keyboard activation event because we
   * need to run `e.preventDefault` as the button or skiplink are both links and we
   * want to apply some additional logic in `exitPage` before navigating.
   *
   * @private
   * @param {MouseEvent} event - mouse click event
   */
  handleClick(event) {
    event.preventDefault();
    this.exitPage();
  }

  /**
   * Logic for the 'quick escape' keyboard sequence functionality (pressing the
   * Shift key three times without interruption, within a time limit).
   *
   * @private
   * @param {KeyboardEvent} event - keyup event
   */
  handleKeypress(event) {
    // Detect if the 'Shift' key has been pressed. We want to only do things if it
    // was pressed by itself and not in a combination with another key—so we keep
    // track of whether the preceding keyup had shiftKey: true on it, and if it
    // did, we ignore the next Shift keyup event.
    //
    // This works because using Shift as a modifier key (e.g. pressing Shift + A)
    // will fire TWO keyup events, one for A (with e.shiftKey: true) and the other
    // for Shift (with e.shiftKey: false).
    if ((event.key === 'Shift' || event.keyCode === 16 || event.which === 16) && !this.lastKeyWasModified) {
      this.keypressCounter += 1;

      // Update the indicator before the below if statement can reset it back to 0
      this.updateIndicator();

      // Clear the timeout for the keypress timeout message clearing itself
      if (this.timeoutMessageId !== null) {
        window.clearTimeout(this.timeoutMessageId);
        this.timeoutMessageId = null;
      }
      if (this.keypressCounter >= 3) {
        this.keypressCounter = 0;
        if (this.keypressTimeoutId !== null) {
          window.clearTimeout(this.keypressTimeoutId);
          this.keypressTimeoutId = null;
        }
        this.exitPage();
      } else {
        if (this.keypressCounter === 1) {
          this.$updateSpan.innerText = this.i18n.t('pressTwoMoreTimes');
        } else {
          this.$updateSpan.innerText = this.i18n.t('pressOneMoreTime');
        }
      }
      this.setKeypressTimer();
    } else if (this.keypressTimeoutId !== null) {
      // If the user pressed any key other than 'Shift', after having pressed
      // 'Shift' and activating the timer, stop and reset the timer.
      this.resetKeypressTimer();
    }

    // Keep track of whether the Shift modifier key was held during this keypress
    this.lastKeyWasModified = event.shiftKey;
  }

  /**
   * Starts the 'quick escape' keyboard sequence timer.
   *
   * This can be invoked several times. We want this to be possible so that the
   * timer is restarted each time the shortcut key is pressed (e.g. the user has
   * up to n seconds between each keypress, rather than n seconds to invoke the
   * entire sequence.)
   *
   * @private
   */
  setKeypressTimer() {
    // Clear any existing timeout. This is so only one timer is running even if
    // there are multiple keypresses in quick succession.
    window.clearTimeout(this.keypressTimeoutId);

    // Set a fresh timeout
    this.keypressTimeoutId = window.setTimeout(this.resetKeypressTimer.bind(this), this.timeoutTime);
  }

  /**
   * Stops and resets the 'quick escape' keyboard sequence timer.
   *
   * @private
   */
  resetKeypressTimer() {
    window.clearTimeout(this.keypressTimeoutId);
    this.keypressTimeoutId = null;
    this.keypressCounter = 0;
    this.$updateSpan.innerText = this.i18n.t('timedOut');
    this.timeoutMessageId = window.setTimeout(() => {
      this.$updateSpan.innerText = '';
    }, this.timeoutTime);
    this.updateIndicator();
  }

  /**
   * Reset the page using the EtP button
   *
   * We use this in situations where a user may re-enter a page using the browser
   * back button. In these cases, the browser can choose to restore the state of
   * the page as it was previously, including restoring the 'ghost page' overlay,
   * the announcement span having it's role set to "alert" and the keypress
   * indicator still active, leaving the page in an unusable state.
   *
   * By running this check when the page is shown, we can programatically restore
   * the page and the component to a "default" state
   *
   * @deprecated Will be made private in v5.0
   */
  resetPage() {
    // If an overlay is set, remove it and reset the value
    document.body.classList.remove('govuk-exit-this-page-hide-content');
    if (this.$overlay) {
      this.$overlay.remove();
      this.$overlay = null;
    }

    // Ensure the announcement span's role is status, not alert and clear any text
    this.$updateSpan.setAttribute('role', 'status');
    this.$updateSpan.innerText = '';

    // Sync the keypress indicator lights
    this.updateIndicator();

    // If the timeouts are active, clear them
    if (this.keypressTimeoutId) {
      window.clearTimeout(this.keypressTimeoutId);
    }
    if (this.timeoutMessageId) {
      window.clearTimeout(this.timeoutMessageId);
    }
  }

  /**
   * Exit this page default config
   *
   * @see {@link ExitThisPageConfig}
   * @constant
   * @default
   * @type {ExitThisPageConfig}
   */
}

/**
 * Exit this Page config
 *
 * @see {@link ExitThisPage.defaults}
 * @typedef {object} ExitThisPageConfig
 * @property {ExitThisPageTranslations} [i18n=ExitThisPage.defaults.i18n] - Exit this page translations
 */

/**
 * Exit this Page translations
 *
 * @see {@link ExitThisPage.defaults.i18n}
 * @typedef {object} ExitThisPageTranslations
 *
 * Messages used by the component programatically inserted text, including
 * overlay text and screen reader announcements.
 * @property {string} [activated] - Screen reader announcement for when EtP
 *   keypress functionality has been successfully activated.
 * @property {string} [timedOut] - Screen reader announcement for when the EtP
 *   keypress functionality has timed out.
 * @property {string} [pressTwoMoreTimes] - Screen reader announcement informing
 *   the user they must press the activation key two more times.
 * @property {string} [pressOneMoreTime] - Screen reader announcement informing
 *   the user they must press the activation key one more time.
 */
ExitThisPage.defaults = Object.freeze({
  i18n: {
    activated: 'Loading.',
    timedOut: 'Exit this page expired.',
    pressTwoMoreTimes: 'Shift, press 2 more times to exit.',
    pressOneMoreTime: 'Shift, press 1 more time to exit.'
  }
});

export { ExitThisPage };
//# sourceMappingURL=exit-this-page.bundle.mjs.map
