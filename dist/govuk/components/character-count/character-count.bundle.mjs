/**
 * Returns the value of the given attribute closest to the given element (including itself)
 *
 * @private
 * @param {Element} $element - The element to start walking the DOM tree up
 * @param {string} attributeName - The name of the attribute
 * @returns {string | null} Attribute value
 */
function closestAttributeValue($element, attributeName) {
  const $closestElementWithAttribute = $element.closest(`[${attributeName}]`);
  return $closestElementWithAttribute ? $closestElementWithAttribute.getAttribute(attributeName) : null;
}

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
 * Character count component
 *
 * Tracks the number of characters or words in the `.govuk-js-character-count`
 * `<textarea>` inside the element. Displays a message with the remaining number
 * of characters/words available, or the number of characters/words in excess.
 *
 * You can configure the message to only appear after a certain percentage
 * of the available characters/words has been entered.
 */
class CharacterCount {
  /**
   * @param {Element} $module - HTML element to use for character count
   * @param {CharacterCountConfig} [config] - Character count config
   */
  constructor($module, config) {
    /** @private */
    this.$module = void 0;
    /** @private */
    this.$textarea = void 0;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$visibleCountMessage = null;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$screenReaderCountMessage = null;
    /**
     * @private
     * @type {number | null}
     */
    this.lastInputTimestamp = null;
    /** @private */
    this.lastInputValue = '';
    /**
     * @private
     * @type {number | null}
     */
    this.valueChecker = null;
    /**
     * @private
     * @type {CharacterCountConfig}
     */
    this.config = void 0;
    /** @private */
    this.i18n = void 0;
    /** @private */
    this.maxLength = Infinity;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    const $textarea = $module.querySelector('.govuk-js-character-count');
    if (!($textarea instanceof HTMLTextAreaElement || $textarea instanceof HTMLInputElement)) {
      return this;
    }

    // Read config set using dataset ('data-' values)
    const datasetConfig = normaliseDataset($module.dataset);

    // To ensure data-attributes take complete precedence, even if they change the
    // type of count, we need to reset the `maxlength` and `maxwords` from the
    // JavaScript config.
    //
    // We can't mutate `config`, though, as it may be shared across multiple
    // components inside `initAll`.
    /** @type {CharacterCountConfig} */
    let configOverrides = {};
    if ('maxwords' in datasetConfig || 'maxlength' in datasetConfig) {
      configOverrides = {
        maxlength: undefined,
        maxwords: undefined
      };
    }
    this.config = mergeConfigs(CharacterCount.defaults, config || {}, configOverrides, datasetConfig);
    this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'), {
      // Read the fallback if necessary rather than have it set in the defaults
      locale: closestAttributeValue($module, 'lang')
    });

    // Determine the limit attribute (characters or words)
    if ('maxwords' in this.config && this.config.maxwords) {
      this.maxLength = this.config.maxwords;
    } else if ('maxlength' in this.config && this.config.maxlength) {
      this.maxLength = this.config.maxlength;
    } else {
      return this;
    }
    this.$module = $module;
    this.$textarea = $textarea;
    const $textareaDescription = document.getElementById(`${this.$textarea.id}-info`);
    if (!$textareaDescription) {
      return;
    }

    // Inject a description for the textarea if none is present already
    // for when the component was rendered with no maxlength, maxwords
    // nor custom textareaDescriptionText
    if ($textareaDescription.innerText.match(/^\s*$/)) {
      $textareaDescription.innerText = this.i18n.t('textareaDescription', {
        count: this.maxLength
      });
    }

    // Move the textarea description to be immediately after the textarea
    // Kept for backwards compatibility
    this.$textarea.insertAdjacentElement('afterend', $textareaDescription);

    // Create the *screen reader* specific live-updating counter
    // This doesn't need any styling classes, as it is never visible
    const $screenReaderCountMessage = document.createElement('div');
    $screenReaderCountMessage.className = 'govuk-character-count__sr-status govuk-visually-hidden';
    $screenReaderCountMessage.setAttribute('aria-live', 'polite');
    this.$screenReaderCountMessage = $screenReaderCountMessage;
    $textareaDescription.insertAdjacentElement('afterend', $screenReaderCountMessage);

    // Create our live-updating counter element, copying the classes from the
    // textarea description for backwards compatibility as these may have been
    // configured
    const $visibleCountMessage = document.createElement('div');
    $visibleCountMessage.className = $textareaDescription.className;
    $visibleCountMessage.classList.add('govuk-character-count__status');
    $visibleCountMessage.setAttribute('aria-hidden', 'true');
    this.$visibleCountMessage = $visibleCountMessage;
    $textareaDescription.insertAdjacentElement('afterend', $visibleCountMessage);

    // Hide the textarea description
    $textareaDescription.classList.add('govuk-visually-hidden');

    // Remove hard limit if set
    this.$textarea.removeAttribute('maxlength');
    this.bindChangeEvents();

    // When the page is restored after navigating 'back' in some browsers the
    // state of form controls is not restored until *after* the DOMContentLoaded
    // event is fired, so we need to sync after the pageshow event.
    window.addEventListener('pageshow', () => this.updateCountMessage());

    // Although we've set up handlers to sync state on the pageshow event, init
    // could be called after those events have fired, for example if they are
    // added to the page dynamically, so update now too.
    this.updateCountMessage();
  }

  /**
   * Bind change events
   *
   * Set up event listeners on the $textarea so that the count messages update
   * when the user types.
   *
   * @private
   */
  bindChangeEvents() {
    this.$textarea.addEventListener('keyup', () => this.handleKeyUp());

    // Bind focus/blur events to start/stop polling
    this.$textarea.addEventListener('focus', () => this.handleFocus());
    this.$textarea.addEventListener('blur', () => this.handleBlur());
  }

  /**
   * Handle key up event
   *
   * Update the visible character counter and keep track of when the last update
   * happened for each keypress
   *
   * @private
   */
  handleKeyUp() {
    this.updateVisibleCountMessage();
    this.lastInputTimestamp = Date.now();
  }

  /**
   * Handle focus event
   *
   * Speech recognition software such as Dragon NaturallySpeaking will modify the
   * fields by directly changing its `value`. These changes don't trigger events
   * in JavaScript, so we need to poll to handle when and if they occur.
   *
   * Once the keyup event hasn't been detected for at least 1000 ms (1s), check if
   * the textarea value has changed and update the count message if it has.
   *
   * This is so that the update triggered by the manual comparison doesn't
   * conflict with debounced KeyboardEvent updates.
   *
   * @private
   */
  handleFocus() {
    this.valueChecker = window.setInterval(() => {
      if (!this.lastInputTimestamp || Date.now() - 500 >= this.lastInputTimestamp) {
        this.updateIfValueChanged();
      }
    }, 1000);
  }

  /**
   * Handle blur event
   *
   * Stop checking the textarea value once the textarea no longer has focus
   *
   * @private
   */
  handleBlur() {
    // Cancel value checking on blur
    clearInterval(this.valueChecker);
  }

  /**
   * Update count message if textarea value has changed
   *
   * @private
   */
  updateIfValueChanged() {
    if (this.$textarea.value !== this.lastInputValue) {
      this.lastInputValue = this.$textarea.value;
      this.updateCountMessage();
    }
  }

  /**
   * Update count message
   *
   * Helper function to update both the visible and screen reader-specific
   * counters simultaneously (e.g. on init)
   *
   * @private
   */
  updateCountMessage() {
    this.updateVisibleCountMessage();
    this.updateScreenReaderCountMessage();
  }

  /**
   * Update visible count message
   *
   * @private
   */
  updateVisibleCountMessage() {
    const remainingNumber = this.maxLength - this.count(this.$textarea.value);

    // If input is over the threshold, remove the disabled class which renders the
    // counter invisible.
    if (this.isOverThreshold()) {
      this.$visibleCountMessage.classList.remove('govuk-character-count__message--disabled');
    } else {
      this.$visibleCountMessage.classList.add('govuk-character-count__message--disabled');
    }

    // Update styles
    if (remainingNumber < 0) {
      this.$textarea.classList.add('govuk-textarea--error');
      this.$visibleCountMessage.classList.remove('govuk-hint');
      this.$visibleCountMessage.classList.add('govuk-error-message');
    } else {
      this.$textarea.classList.remove('govuk-textarea--error');
      this.$visibleCountMessage.classList.remove('govuk-error-message');
      this.$visibleCountMessage.classList.add('govuk-hint');
    }

    // Update message
    this.$visibleCountMessage.innerText = this.getCountMessage();
  }

  /**
   * Update screen reader count message
   *
   * @private
   */
  updateScreenReaderCountMessage() {
    // If over the threshold, remove the aria-hidden attribute, allowing screen
    // readers to announce the content of the element.
    if (this.isOverThreshold()) {
      this.$screenReaderCountMessage.removeAttribute('aria-hidden');
    } else {
      this.$screenReaderCountMessage.setAttribute('aria-hidden', 'true');
    }

    // Update message
    this.$screenReaderCountMessage.innerText = this.getCountMessage();
  }

  /**
   * Count the number of characters (or words, if `config.maxwords` is set)
   * in the given text
   *
   * @private
   * @param {string} text - The text to count the characters of
   * @returns {number} the number of characters (or words) in the text
   */
  count(text) {
    if ('maxwords' in this.config && this.config.maxwords) {
      const tokens = text.match(/\S+/g) || []; // Matches consecutive non-whitespace chars
      return tokens.length;
    } else {
      return text.length;
    }
  }

  /**
   * Get count message
   *
   * @private
   * @returns {string} Status message
   */
  getCountMessage() {
    const remainingNumber = this.maxLength - this.count(this.$textarea.value);
    const countType = 'maxwords' in this.config && this.config.maxwords ? 'words' : 'characters';
    return this.formatCountMessage(remainingNumber, countType);
  }

  /**
   * Formats the message shown to users according to what's counted
   * and how many remain
   *
   * @private
   * @param {number} remainingNumber - The number of words/characaters remaining
   * @param {string} countType - "words" or "characters"
   * @returns {string} Status message
   */
  formatCountMessage(remainingNumber, countType) {
    if (remainingNumber === 0) {
      return this.i18n.t(`${countType}AtLimit`);
    }
    const translationKeySuffix = remainingNumber < 0 ? 'OverLimit' : 'UnderLimit';
    return this.i18n.t(`${countType}${translationKeySuffix}`, {
      count: Math.abs(remainingNumber)
    });
  }

  /**
   * Check if count is over threshold
   *
   * Checks whether the value is over the configured threshold for the input.
   * If there is no configured threshold, it is set to 0 and this function will
   * always return true.
   *
   * @private
   * @returns {boolean} true if the current count is over the config.threshold
   *   (or no threshold is set)
   */
  isOverThreshold() {
    // No threshold means we're always above threshold so save some computation
    if (!this.config.threshold) {
      return true;
    }

    // Determine the remaining number of characters/words
    const currentLength = this.count(this.$textarea.value);
    const maxLength = this.maxLength;
    const thresholdValue = maxLength * this.config.threshold / 100;
    return thresholdValue <= currentLength;
  }

  /**
   * Character count default config
   *
   * @see {@link CharacterCountConfig}
   * @constant
   * @default
   * @type {CharacterCountConfig}
   */
}

/**
 * Character count config
 *
 * @see {@link CharacterCount.defaults}
 * @typedef {CharacterCountConfigWithMaxLength | CharacterCountConfigWithMaxWords} CharacterCountConfig
 */

/**
 * Character count config (with maximum number of characters)
 *
 * @see {@link CharacterCount.defaults}
 * @typedef {object} CharacterCountConfigWithMaxLength
 * @property {number} [maxlength] - The maximum number of characters.
 *   If maxwords is provided, the maxlength option will be ignored.
 * @property {number} [threshold=0] - The percentage value of the limit at
 *   which point the count message is displayed. If this attribute is set, the
 *   count message will be hidden by default.
 * @property {CharacterCountTranslations} [i18n=CharacterCount.defaults.i18n] - Character count translations
 */

/**
 * Character count config (with maximum number of words)
 *
 * @see {@link CharacterCount.defaults}
 * @typedef {object} CharacterCountConfigWithMaxWords
 * @property {number} [maxwords] - The maximum number of words. If maxwords is
 *   provided, the maxlength option will be ignored.
 * @property {number} [threshold=0] - The percentage value of the limit at
 *   which point the count message is displayed. If this attribute is set, the
 *   count message will be hidden by default.
 * @property {CharacterCountTranslations} [i18n=CharacterCount.defaults.i18n] - Character count translations
 */

/**
 * Character count translations
 *
 * @see {@link CharacterCount.defaults.i18n}
 * @typedef {object} CharacterCountTranslations
 *
 * Messages shown to users as they type. It provides feedback on how many words
 * or characters they have remaining or if they are over the limit. This also
 * includes a message used as an accessible description for the textarea.
 * @property {TranslationPluralForms} [charactersUnderLimit] - Message displayed
 *   when the number of characters is under the configured maximum, `maxlength`.
 *   This message is displayed visually and through assistive technologies. The
 *   component will replace the `%{count}` placeholder with the number of
 *   remaining characters. This is a [pluralised list of
 *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
 * @property {string} [charactersAtLimit] - Message displayed when the number of
 *   characters reaches the configured maximum, `maxlength`. This message is
 *   displayed visually and through assistive technologies.
 * @property {TranslationPluralForms} [charactersOverLimit] - Message displayed
 *   when the number of characters is over the configured maximum, `maxlength`.
 *   This message is displayed visually and through assistive technologies. The
 *   component will replace the `%{count}` placeholder with the number of
 *   remaining characters. This is a [pluralised list of
 *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
 * @property {TranslationPluralForms} [wordsUnderLimit] - Message displayed when
 *   the number of words is under the configured maximum, `maxlength`. This
 *   message is displayed visually and through assistive technologies. The
 *   component will replace the `%{count}` placeholder with the number of
 *   remaining words. This is a [pluralised list of
 *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
 * @property {string} [wordsAtLimit] - Message displayed when the number of
 *   words reaches the configured maximum, `maxlength`. This message is
 *   displayed visually and through assistive technologies.
 * @property {TranslationPluralForms} [wordsOverLimit] - Message displayed when
 *   the number of words is over the configured maximum, `maxlength`. This
 *   message is displayed visually and through assistive technologies. The
 *   component will replace the `%{count}` placeholder with the number of
 *   remaining words. This is a [pluralised list of
 *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
 * @property {TranslationPluralForms} [textareaDescription] - Message made
 *   available to assistive technologies, if none is already present in the
 *   HTML, to describe that the component accepts only a limited amount of
 *   content. It is visible on the page when JavaScript is unavailable. The
 *   component will replace the `%{count}` placeholder with the value of the
 *   `maxlength` or `maxwords` parameter.
 */

/**
 * @typedef {import('../../i18n.mjs').TranslationPluralForms} TranslationPluralForms
 */
CharacterCount.defaults = Object.freeze({
  threshold: 0,
  i18n: {
    // Characters
    charactersUnderLimit: {
      one: 'You have %{count} character remaining',
      other: 'You have %{count} characters remaining'
    },
    charactersAtLimit: 'You have 0 characters remaining',
    charactersOverLimit: {
      one: 'You have %{count} character too many',
      other: 'You have %{count} characters too many'
    },
    // Words
    wordsUnderLimit: {
      one: 'You have %{count} word remaining',
      other: 'You have %{count} words remaining'
    },
    wordsAtLimit: 'You have 0 words remaining',
    wordsOverLimit: {
      one: 'You have %{count} word too many',
      other: 'You have %{count} words too many'
    },
    textareaDescription: {
      other: ''
    }
  }
});

export { CharacterCount };
//# sourceMappingURL=character-count.bundle.mjs.map
