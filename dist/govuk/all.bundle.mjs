/*
 * This variable is automatically overwritten during builds and releases.
 * It doesn't need to be updated manually.
 */

/**
 * GOV.UK Frontend release version
 *
 * {@link https://github.com/alphagov/govuk-frontend/releases}
 */
const version = '4.6.0';

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

/**
 * Checkboxes component
 */
class Checkboxes {
  /**
   * Checkboxes can be associated with a 'conditionally revealed' content block –
   * for example, a checkbox for 'Phone' could reveal an additional form field for
   * the user to enter their phone number.
   *
   * These associations are made using a `data-aria-controls` attribute, which is
   * promoted to an aria-controls attribute during initialisation.
   *
   * We also need to restore the state of any conditional reveals on the page (for
   * example if the user has navigated back), and set up event handlers to keep
   * the reveal in sync with the checkbox state.
   *
   * @param {Element} $module - HTML element to use for checkboxes
   */
  constructor($module) {
    /** @private */
    this.$module = void 0;
    /** @private */
    this.$inputs = void 0;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }

    /** @satisfies {NodeListOf<HTMLInputElement>} */
    const $inputs = $module.querySelectorAll('input[type="checkbox"]');
    if (!$inputs.length) {
      return this;
    }
    this.$module = $module;
    this.$inputs = $inputs;
    this.$inputs.forEach($input => {
      const targetId = $input.getAttribute('data-aria-controls');

      // Skip checkboxes without data-aria-controls attributes, or where the
      // target element does not exist.
      if (!targetId || !document.getElementById(targetId)) {
        return;
      }

      // Promote the data-aria-controls attribute to a aria-controls attribute
      // so that the relationship is exposed in the AOM
      $input.setAttribute('aria-controls', targetId);
      $input.removeAttribute('data-aria-controls');
    });

    // When the page is restored after navigating 'back' in some browsers the
    // state of form controls is not restored until *after* the DOMContentLoaded
    // event is fired, so we need to sync after the pageshow event.
    window.addEventListener('pageshow', () => this.syncAllConditionalReveals());

    // Although we've set up handlers to sync state on the pageshow event, init
    // could be called after those events have fired, for example if they are
    // added to the page dynamically, so sync now too.
    this.syncAllConditionalReveals();

    // Handle events
    this.$module.addEventListener('click', event => this.handleClick(event));
  }

  /**
   * Sync the conditional reveal states for all checkboxes in this $module.
   *
   * @private
   */
  syncAllConditionalReveals() {
    this.$inputs.forEach($input => this.syncConditionalRevealWithInputState($input));
  }

  /**
   * Sync conditional reveal with the input state
   *
   * Synchronise the visibility of the conditional reveal, and its accessible
   * state, with the input's checked state.
   *
   * @private
   * @param {HTMLInputElement} $input - Checkbox input
   */
  syncConditionalRevealWithInputState($input) {
    const targetId = $input.getAttribute('aria-controls');
    if (!targetId) {
      return;
    }
    const $target = document.getElementById(targetId);
    if ($target && $target.classList.contains('govuk-checkboxes__conditional')) {
      const inputIsChecked = $input.checked;
      $input.setAttribute('aria-expanded', inputIsChecked.toString());
      $target.classList.toggle('govuk-checkboxes__conditional--hidden', !inputIsChecked);
    }
  }

  /**
   * Uncheck other checkboxes
   *
   * Find any other checkbox inputs with the same name value, and uncheck them.
   * This is useful for when a “None of these" checkbox is checked.
   *
   * @private
   * @param {HTMLInputElement} $input - Checkbox input
   */
  unCheckAllInputsExcept($input) {
    /** @satisfies {NodeListOf<HTMLInputElement>} */
    const allInputsWithSameName = document.querySelectorAll(`input[type="checkbox"][name="${$input.name}"]`);
    allInputsWithSameName.forEach($inputWithSameName => {
      const hasSameFormOwner = $input.form === $inputWithSameName.form;
      if (hasSameFormOwner && $inputWithSameName !== $input) {
        $inputWithSameName.checked = false;
        this.syncConditionalRevealWithInputState($inputWithSameName);
      }
    });
  }

  /**
   * Uncheck exclusive checkboxes
   *
   * Find any checkbox inputs with the same name value and the 'exclusive' behaviour,
   * and uncheck them. This helps prevent someone checking both a regular checkbox and a
   * "None of these" checkbox in the same fieldset.
   *
   * @private
   * @param {HTMLInputElement} $input - Checkbox input
   */
  unCheckExclusiveInputs($input) {
    /** @satisfies {NodeListOf<HTMLInputElement>} */
    const allInputsWithSameNameAndExclusiveBehaviour = document.querySelectorAll(`input[data-behaviour="exclusive"][type="checkbox"][name="${$input.name}"]`);
    allInputsWithSameNameAndExclusiveBehaviour.forEach($exclusiveInput => {
      const hasSameFormOwner = $input.form === $exclusiveInput.form;
      if (hasSameFormOwner) {
        $exclusiveInput.checked = false;
        this.syncConditionalRevealWithInputState($exclusiveInput);
      }
    });
  }

  /**
   * Click event handler
   *
   * Handle a click within the $module – if the click occurred on a checkbox, sync
   * the state of any associated conditional reveal with the checkbox state.
   *
   * @private
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    const $clickedInput = event.target;

    // Ignore clicks on things that aren't checkbox inputs
    if (!($clickedInput instanceof HTMLInputElement) || $clickedInput.type !== 'checkbox') {
      return;
    }

    // If the checkbox conditionally-reveals some content, sync the state
    const hasAriaControls = $clickedInput.getAttribute('aria-controls');
    if (hasAriaControls) {
      this.syncConditionalRevealWithInputState($clickedInput);
    }

    // No further behaviour needed for unchecking
    if (!$clickedInput.checked) {
      return;
    }

    // Handle 'exclusive' checkbox behaviour (ie "None of these")
    const hasBehaviourExclusive = $clickedInput.getAttribute('data-behaviour') === 'exclusive';
    if (hasBehaviourExclusive) {
      this.unCheckAllInputsExcept($clickedInput);
    } else {
      this.unCheckExclusiveInputs($clickedInput);
    }
  }
}

/**
 * Error summary component
 *
 * Takes focus on initialisation for accessible announcement, unless disabled in configuration.
 */
class ErrorSummary {
  /**
   *
   * @param {Element} $module - HTML element to use for error summary
   * @param {ErrorSummaryConfig} [config] - Error summary config
   */
  constructor($module, config) {
    /** @private */
    this.$module = void 0;
    /**
     * @private
     * @type {ErrorSummaryConfig}
     */
    this.config = void 0;
    // Some consuming code may not be passing a module,
    // for example if they initialise the component
    // on their own by directly passing the result
    // of `document.querySelector`.
    // To avoid breaking further JavaScript initialisation
    // we need to safeguard against this so things keep
    // working the same now we read the elements data attributes
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    this.$module = $module;
    this.config = mergeConfigs(ErrorSummary.defaults, config || {}, normaliseDataset($module.dataset));
    this.setFocus();
    this.$module.addEventListener('click', event => this.handleClick(event));
  }

  /**
   * Focus the error summary
   *
   * @private
   */
  setFocus() {
    if (this.config.disableAutoFocus) {
      return;
    }

    // Set tabindex to -1 to make the element programmatically focusable, but
    // remove it on blur as the error summary doesn't need to be focused again.
    this.$module.setAttribute('tabindex', '-1');
    this.$module.addEventListener('blur', () => {
      this.$module.removeAttribute('tabindex');
    });
    this.$module.focus();
  }

  /**
   * Click event handler
   *
   * @private
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    const $target = event.target;
    if (this.focusTarget($target)) {
      event.preventDefault();
    }
  }

  /**
   * Focus the target element
   *
   * By default, the browser will scroll the target into view. Because our labels
   * or legends appear above the input, this means the user will be presented with
   * an input without any context, as the label or legend will be off the top of
   * the screen.
   *
   * Manually handling the click event, scrolling the question into view and then
   * focussing the element solves this.
   *
   * This also results in the label and/or legend being announced correctly in
   * NVDA (as tested in 2018.3.2) - without this only the field type is announced
   * (e.g. "Edit, has autocomplete").
   *
   * @private
   * @param {EventTarget} $target - Event target
   * @returns {boolean} True if the target was able to be focussed
   */
  focusTarget($target) {
    // If the element that was clicked was not a link, return early
    if (!($target instanceof HTMLAnchorElement)) {
      return false;
    }
    const inputId = this.getFragmentFromUrl($target.href);
    if (!inputId) {
      return false;
    }
    const $input = document.getElementById(inputId);
    if (!$input) {
      return false;
    }
    const $legendOrLabel = this.getAssociatedLegendOrLabel($input);
    if (!$legendOrLabel) {
      return false;
    }

    // Scroll the legend or label into view *before* calling focus on the input to
    // avoid extra scrolling in browsers that don't support `preventScroll` (which
    // at time of writing is most of them...)
    $legendOrLabel.scrollIntoView();
    $input.focus({
      preventScroll: true
    });
    return true;
  }

  /**
   * Get fragment from URL
   *
   * Extract the fragment (everything after the hash) from a URL, but not including
   * the hash.
   *
   * @private
   * @param {string} url - URL
   * @returns {string | undefined} Fragment from URL, without the hash
   */
  getFragmentFromUrl(url) {
    if (url.indexOf('#') === -1) {
      return undefined;
    }
    return url.split('#').pop();
  }

  /**
   * Get associated legend or label
   *
   * Returns the first element that exists from this list:
   *
   * - The `<legend>` associated with the closest `<fieldset>` ancestor, as long
   *   as the top of it is no more than half a viewport height away from the
   *   bottom of the input
   * - The first `<label>` that is associated with the input using for="inputId"
   * - The closest parent `<label>`
   *
   * @private
   * @param {Element} $input - The input
   * @returns {Element | null} Associated legend or label, or null if no associated
   *   legend or label can be found
   */
  getAssociatedLegendOrLabel($input) {
    const $fieldset = $input.closest('fieldset');
    if ($fieldset) {
      const $legends = $fieldset.getElementsByTagName('legend');
      if ($legends.length) {
        const $candidateLegend = $legends[0];

        // If the input type is radio or checkbox, always use the legend if there
        // is one.
        if ($input instanceof HTMLInputElement && ($input.type === 'checkbox' || $input.type === 'radio')) {
          return $candidateLegend;
        }

        // For other input types, only scroll to the fieldset’s legend (instead of
        // the label associated with the input) if the input would end up in the
        // top half of the screen.
        //
        // This should avoid situations where the input either ends up off the
        // screen, or obscured by a software keyboard.
        const legendTop = $candidateLegend.getBoundingClientRect().top;
        const inputRect = $input.getBoundingClientRect();

        // If the browser doesn't support Element.getBoundingClientRect().height
        // or window.innerHeight (like IE8), bail and just link to the label.
        if (inputRect.height && window.innerHeight) {
          const inputBottom = inputRect.top + inputRect.height;
          if (inputBottom - legendTop < window.innerHeight / 2) {
            return $candidateLegend;
          }
        }
      }
    }
    return document.querySelector(`label[for='${$input.getAttribute('id')}']`) || $input.closest('label');
  }

  /**
   * Error summary default config
   *
   * @see {@link ErrorSummaryConfig}
   * @constant
   * @default
   * @type {ErrorSummaryConfig}
   */
}

/**
 * Error summary config
 *
 * @typedef {object} ErrorSummaryConfig
 * @property {boolean} [disableAutoFocus=false] - If set to `true` the error
 *   summary will not be focussed when the page loads.
 */
ErrorSummary.defaults = Object.freeze({
  disableAutoFocus: false
});

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

/**
 * Header component
 */
class Header {
  /**
   * Apply a matchMedia for desktop which will trigger a state sync if the browser
   * viewport moves between states.
   *
   * @param {Element} $module - HTML element to use for header
   */
  constructor($module) {
    /** @private */
    this.$module = void 0;
    /** @private */
    this.$menuButton = void 0;
    /** @private */
    this.$menu = void 0;
    /**
     * Save the opened/closed state for the nav in memory so that we can
     * accurately maintain state when the screen is changed from small to
     * big and back to small
     *
     * @private
     */
    this.menuIsOpen = false;
    /**
     * A global const for storing a matchMedia instance which we'll use to
     * detect when a screen size change happens. We rely on it being null if the
     * feature isn't available to initially apply hidden attributes
     *
     * @private
     * @type {MediaQueryList | null}
     */
    this.mql = null;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    this.$module = $module;
    this.$menuButton = $module.querySelector('.govuk-js-header-toggle');
    this.$menu = this.$menuButton && $module.querySelector(`#${this.$menuButton.getAttribute('aria-controls')}`);
    if (!(this.$menuButton instanceof HTMLElement || this.$menu instanceof HTMLElement)) {
      return this;
    }

    // Set the matchMedia to the govuk-frontend desktop breakpoint
    this.mql = window.matchMedia('(min-width: 48.0625em)');

    // MediaQueryList.addEventListener isn't supported by Safari < 14 so we need
    // to be able to fall back to the deprecated MediaQueryList.addListener
    if ('addEventListener' in this.mql) {
      this.mql.addEventListener('change', () => this.syncState());
    } else {
      // @ts-expect-error Property 'addListener' does not exist
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.mql.addListener(() => this.syncState());
    }
    this.syncState();
    this.$menuButton.addEventListener('click', () => this.handleMenuButtonClick());
  }

  /**
   * Sync menu state
   *
   * Uses the global variable menuIsOpen to correctly set the accessible and
   * visual states of the menu and the menu button.
   * Additionally will force the menu to be visible and the menu button to be
   * hidden if the matchMedia is triggered to desktop.
   *
   * @private
   */
  syncState() {
    if (this.mql.matches) {
      this.$menu.removeAttribute('hidden');
      this.$menuButton.setAttribute('hidden', '');
    } else {
      this.$menuButton.removeAttribute('hidden');
      this.$menuButton.setAttribute('aria-expanded', this.menuIsOpen.toString());
      if (this.menuIsOpen) {
        this.$menu.removeAttribute('hidden');
      } else {
        this.$menu.setAttribute('hidden', '');
      }
    }
  }

  /**
   * Handle menu button click
   *
   * When the menu button is clicked, change the visibility of the menu and then
   * sync the accessibility state and menu button state
   *
   * @private
   */
  handleMenuButtonClick() {
    this.menuIsOpen = !this.menuIsOpen;
    this.syncState();
  }
}

/**
 * Notification Banner component
 */
class NotificationBanner {
  /**
   * @param {Element} $module - HTML element to use for notification banner
   * @param {NotificationBannerConfig} [config] - Notification banner config
   */
  constructor($module, config) {
    /** @private */
    this.$module = void 0;
    /**
     * @private
     * @type {NotificationBannerConfig}
     */
    this.config = void 0;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    this.$module = $module;
    this.config = mergeConfigs(NotificationBanner.defaults, config || {}, normaliseDataset($module.dataset));
    this.setFocus();
  }

  /**
   * Focus the element
   *
   * If `role="alert"` is set, focus the element to help some assistive technologies
   * prioritise announcing it.
   *
   * You can turn off the auto-focus functionality by setting `data-disable-auto-focus="true"` in the
   * component HTML. You might wish to do this based on user research findings, or to avoid a clash
   * with another element which should be focused when the page loads.
   *
   * @private
   */
  setFocus() {
    if (this.config.disableAutoFocus) {
      return;
    }
    if (this.$module.getAttribute('role') !== 'alert') {
      return;
    }

    // Set tabindex to -1 to make the element focusable with JavaScript.
    // Remove the tabindex on blur as the component doesn't need to be focusable after the page has
    // loaded.
    if (!this.$module.getAttribute('tabindex')) {
      this.$module.setAttribute('tabindex', '-1');
      this.$module.addEventListener('blur', () => {
        this.$module.removeAttribute('tabindex');
      });
    }
    this.$module.focus();
  }

  /**
   * Notification banner default config
   *
   * @see {@link NotificationBannerConfig}
   * @constant
   * @default
   * @type {NotificationBannerConfig}
   */
}

/**
 * Notification banner config
 *
 * @typedef {object} NotificationBannerConfig
 * @property {boolean} [disableAutoFocus=false] - If set to `true` the
 *   notification banner will not be focussed when the page loads. This only
 *   applies if the component has a `role` of `alert` – in other cases the
 *   component will not be focused on page load, regardless of this option.
 */
NotificationBanner.defaults = Object.freeze({
  disableAutoFocus: false
});

/**
 * Radios component
 */
class Radios {
  /**
   * Radios can be associated with a 'conditionally revealed' content block – for
   * example, a radio for 'Phone' could reveal an additional form field for the
   * user to enter their phone number.
   *
   * These associations are made using a `data-aria-controls` attribute, which is
   * promoted to an aria-controls attribute during initialisation.
   *
   * We also need to restore the state of any conditional reveals on the page (for
   * example if the user has navigated back), and set up event handlers to keep
   * the reveal in sync with the radio state.
   *
   * @param {Element} $module - HTML element to use for radios
   */
  constructor($module) {
    /** @private */
    this.$module = void 0;
    /** @private */
    this.$inputs = void 0;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }

    /** @satisfies {NodeListOf<HTMLInputElement>} */
    const $inputs = $module.querySelectorAll('input[type="radio"]');
    if (!$inputs.length) {
      return this;
    }
    this.$module = $module;
    this.$inputs = $inputs;
    this.$inputs.forEach($input => {
      const targetId = $input.getAttribute('data-aria-controls');

      // Skip radios without data-aria-controls attributes, or where the
      // target element does not exist.
      if (!targetId || !document.getElementById(targetId)) {
        return;
      }

      // Promote the data-aria-controls attribute to a aria-controls attribute
      // so that the relationship is exposed in the AOM
      $input.setAttribute('aria-controls', targetId);
      $input.removeAttribute('data-aria-controls');
    });

    // When the page is restored after navigating 'back' in some browsers the
    // state of form controls is not restored until *after* the DOMContentLoaded
    // event is fired, so we need to sync after the pageshow event.
    window.addEventListener('pageshow', () => this.syncAllConditionalReveals());

    // Although we've set up handlers to sync state on the pageshow event, init
    // could be called after those events have fired, for example if they are
    // added to the page dynamically, so sync now too.
    this.syncAllConditionalReveals();

    // Handle events
    this.$module.addEventListener('click', event => this.handleClick(event));
  }

  /**
   * Sync the conditional reveal states for all radio buttons in this $module.
   *
   * @private
   */
  syncAllConditionalReveals() {
    this.$inputs.forEach($input => this.syncConditionalRevealWithInputState($input));
  }

  /**
   * Sync conditional reveal with the input state
   *
   * Synchronise the visibility of the conditional reveal, and its accessible
   * state, with the input's checked state.
   *
   * @private
   * @param {HTMLInputElement} $input - Radio input
   */
  syncConditionalRevealWithInputState($input) {
    const targetId = $input.getAttribute('aria-controls');
    if (!targetId) {
      return;
    }
    const $target = document.getElementById(targetId);
    if ($target && $target.classList.contains('govuk-radios__conditional')) {
      const inputIsChecked = $input.checked;
      $input.setAttribute('aria-expanded', inputIsChecked.toString());
      $target.classList.toggle('govuk-radios__conditional--hidden', !inputIsChecked);
    }
  }

  /**
   * Click event handler
   *
   * Handle a click within the $module – if the click occurred on a radio, sync
   * the state of the conditional reveal for all radio buttons in the same form
   * with the same name (because checking one radio could have un-checked a radio
   * in another $module)
   *
   * @private
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    const $clickedInput = event.target;

    // Ignore clicks on things that aren't radio buttons
    if (!($clickedInput instanceof HTMLInputElement) || $clickedInput.type !== 'radio') {
      return;
    }

    // We only need to consider radios with conditional reveals, which will have
    // aria-controls attributes.
    /** @satisfies {NodeListOf<HTMLInputElement>} */
    const $allInputs = document.querySelectorAll('input[type="radio"][aria-controls]');
    const $clickedInputForm = $clickedInput.form;
    const $clickedInputName = $clickedInput.name;
    $allInputs.forEach($input => {
      const hasSameFormOwner = $input.form === $clickedInputForm;
      const hasSameName = $input.name === $clickedInputName;
      if (hasSameName && hasSameFormOwner) {
        this.syncConditionalRevealWithInputState($input);
      }
    });
  }
}

/**
 * Skip link component
 */
class SkipLink {
  /**
   *
   * @param {Element} $module - HTML element to use for skip link
   */
  constructor($module) {
    /** @private */
    this.$module = void 0;
    /**
     * @private
     * @type {HTMLElement | null}
     */
    this.$linkedElement = null;
    /** @private */
    this.linkedElementListener = false;
    if (!($module instanceof HTMLAnchorElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }
    this.$module = $module;

    // Check for linked element
    const $linkedElement = this.getLinkedElement();
    if (!$linkedElement) {
      return;
    }
    this.$linkedElement = $linkedElement;
    this.$module.addEventListener('click', () => this.focusLinkedElement());
  }

  /**
   * Get linked element
   *
   * @private
   * @returns {HTMLElement | null} $linkedElement - DOM element linked to from the skip link
   */
  getLinkedElement() {
    const linkedElementId = this.getFragmentFromUrl();
    if (!linkedElementId) {
      return null;
    }
    return document.getElementById(linkedElementId);
  }

  /**
   * Focus the linked element
   *
   * Set tabindex and helper CSS class. Set listener to remove them on blur.
   *
   * @private
   */
  focusLinkedElement() {
    if (!this.$linkedElement.getAttribute('tabindex')) {
      // Set the element tabindex to -1 so it can be focused with JavaScript.
      this.$linkedElement.setAttribute('tabindex', '-1');
      this.$linkedElement.classList.add('govuk-skip-link-focused-element');

      // Add listener for blur on the focused element (unless the listener has previously been added)
      if (!this.linkedElementListener) {
        this.$linkedElement.addEventListener('blur', () => this.removeFocusProperties());
        this.linkedElementListener = true;
      }
    }
    this.$linkedElement.focus();
  }

  /**
   * Remove the tabindex that makes the linked element focusable because the element only needs to be
   * focusable until it has received programmatic focus and a screen reader has announced it.
   *
   * Remove the CSS class that removes the native focus styles.
   *
   * @private
   */
  removeFocusProperties() {
    this.$linkedElement.removeAttribute('tabindex');
    this.$linkedElement.classList.remove('govuk-skip-link-focused-element');
  }

  /**
   * Get fragment from URL
   *
   * Extract the fragment (everything after the hash symbol) from a URL, but not including
   * the symbol.
   *
   * @private
   * @returns {string | undefined} Fragment from URL, without the hash symbol
   */
  getFragmentFromUrl() {
    // Bail if the anchor link doesn't have a hash
    if (!this.$module.hash) {
      return;
    }
    return this.$module.hash.split('#').pop();
  }
}

/**
 * Tabs component
 */
class Tabs {
  /**
   * @param {Element} $module - HTML element to use for tabs
   */
  constructor($module) {
    /** @private */
    this.$module = void 0;
    /** @private */
    this.$tabs = void 0;
    /** @private */
    this.keys = {
      left: 37,
      right: 39,
      up: 38,
      down: 40
    };
    /** @private */
    this.jsHiddenClass = 'govuk-tabs__panel--hidden';
    /** @private */
    this.changingHash = false;
    /** @private */
    this.boundTabClick = void 0;
    /** @private */
    this.boundTabKeydown = void 0;
    /** @private */
    this.boundOnHashChange = void 0;
    /**
     * @private
     * @type {MediaQueryList | null}
     */
    this.mql = null;
    if (!($module instanceof HTMLElement) || !document.body.classList.contains('govuk-frontend-supported')) {
      return this;
    }

    /** @satisfies {NodeListOf<HTMLAnchorElement>} */
    const $tabs = $module.querySelectorAll('a.govuk-tabs__tab');
    if (!$tabs.length) {
      return this;
    }
    this.$module = $module;
    this.$tabs = $tabs;

    // Save bounded functions to use when removing event listeners during teardown
    this.boundTabClick = this.onTabClick.bind(this);
    this.boundTabKeydown = this.onTabKeydown.bind(this);
    this.boundOnHashChange = this.onHashChange.bind(this);
    this.setupResponsiveChecks();
  }

  /**
   * Setup viewport resize check
   *
   * @private
   */
  setupResponsiveChecks() {
    this.mql = window.matchMedia('(min-width: 40.0625em)');

    // MediaQueryList.addEventListener isn't supported by Safari < 14 so we need
    // to be able to fall back to the deprecated MediaQueryList.addListener
    if ('addEventListener' in this.mql) {
      this.mql.addEventListener('change', () => this.checkMode());
    } else {
      // @ts-expect-error Property 'addListener' does not exist
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.mql.addListener(() => this.checkMode());
    }
    this.checkMode();
  }

  /**
   * Setup or teardown handler for viewport resize check
   *
   * @private
   */
  checkMode() {
    if (this.mql.matches) {
      this.setup();
    } else {
      this.teardown();
    }
  }

  /**
   * Setup tab component
   *
   * @private
   */
  setup() {
    const $tabList = this.$module.querySelector('.govuk-tabs__list');
    const $tabListItems = this.$module.querySelectorAll('.govuk-tabs__list-item');
    if (!this.$tabs || !$tabList || !$tabListItems) {
      return;
    }
    $tabList.setAttribute('role', 'tablist');
    $tabListItems.forEach($item => {
      $item.setAttribute('role', 'presentation');
    });
    this.$tabs.forEach($tab => {
      // Set HTML attributes
      this.setAttributes($tab);

      // Handle events
      $tab.addEventListener('click', this.boundTabClick, true);
      $tab.addEventListener('keydown', this.boundTabKeydown, true);

      // Remove old active panels
      this.hideTab($tab);
    });

    // Show either the active tab according to the URL's hash or the first tab
    const $activeTab = this.getTab(window.location.hash) || this.$tabs[0];
    if (!$activeTab) {
      return;
    }
    this.showTab($activeTab);

    // Handle hashchange events
    window.addEventListener('hashchange', this.boundOnHashChange, true);
  }

  /**
   * Teardown tab component
   *
   * @private
   */
  teardown() {
    const $tabList = this.$module.querySelector('.govuk-tabs__list');
    const $tabListItems = this.$module.querySelectorAll('a.govuk-tabs__list-item');
    if (!this.$tabs || !$tabList || !$tabListItems) {
      return;
    }
    $tabList.removeAttribute('role');
    $tabListItems.forEach($item => {
      $item.removeAttribute('role');
    });
    this.$tabs.forEach($tab => {
      // Remove events
      $tab.removeEventListener('click', this.boundTabClick, true);
      $tab.removeEventListener('keydown', this.boundTabKeydown, true);

      // Unset HTML attributes
      this.unsetAttributes($tab);
    });

    // Remove hashchange event handler
    window.removeEventListener('hashchange', this.boundOnHashChange, true);
  }

  /**
   * Handle hashchange event
   *
   * @private
   * @returns {void | undefined} Returns void, or undefined when prevented
   */
  onHashChange() {
    const hash = window.location.hash;
    const $tabWithHash = this.getTab(hash);
    if (!$tabWithHash) {
      return;
    }

    // Prevent changing the hash
    if (this.changingHash) {
      this.changingHash = false;
      return;
    }

    // Show either the active tab according to the URL's hash or the first tab
    const $previousTab = this.getCurrentTab();
    if (!$previousTab) {
      return;
    }
    this.hideTab($previousTab);
    this.showTab($tabWithHash);
    $tabWithHash.focus();
  }

  /**
   * Hide panel for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  hideTab($tab) {
    this.unhighlightTab($tab);
    this.hidePanel($tab);
  }

  /**
   * Show panel for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  showTab($tab) {
    this.highlightTab($tab);
    this.showPanel($tab);
  }

  /**
   * Get tab link by hash
   *
   * @private
   * @param {string} hash - Hash fragment including #
   * @returns {HTMLAnchorElement | null} Tab link
   */
  getTab(hash) {
    return this.$module.querySelector(`a.govuk-tabs__tab[href="${hash}"]`);
  }

  /**
   * Set tab link and panel attributes
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  setAttributes($tab) {
    // set tab attributes
    const panelId = this.getHref($tab).slice(1);
    $tab.setAttribute('id', `tab_${panelId}`);
    $tab.setAttribute('role', 'tab');
    $tab.setAttribute('aria-controls', panelId);
    $tab.setAttribute('aria-selected', 'false');
    $tab.setAttribute('tabindex', '-1');

    // set panel attributes
    const $panel = this.getPanel($tab);
    if (!$panel) {
      return;
    }
    $panel.setAttribute('role', 'tabpanel');
    $panel.setAttribute('aria-labelledby', $tab.id);
    $panel.classList.add(this.jsHiddenClass);
  }

  /**
   * Unset tab link and panel attributes
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  unsetAttributes($tab) {
    // unset tab attributes
    $tab.removeAttribute('id');
    $tab.removeAttribute('role');
    $tab.removeAttribute('aria-controls');
    $tab.removeAttribute('aria-selected');
    $tab.removeAttribute('tabindex');

    // unset panel attributes
    const $panel = this.getPanel($tab);
    if (!$panel) {
      return;
    }
    $panel.removeAttribute('role');
    $panel.removeAttribute('aria-labelledby');
    $panel.classList.remove(this.jsHiddenClass);
  }

  /**
   * Handle tab link clicks
   *
   * @private
   * @param {MouseEvent} event - Mouse click event
   * @returns {void} Returns void
   */
  onTabClick(event) {
    const $currentTab = this.getCurrentTab();
    const $nextTab = event.currentTarget;
    if (!$currentTab || !($nextTab instanceof HTMLAnchorElement)) {
      return;
    }
    event.preventDefault();
    this.hideTab($currentTab);
    this.showTab($nextTab);
    this.createHistoryEntry($nextTab);
  }

  /**
   * Update browser URL hash fragment for tab
   *
   * - Allows back/forward to navigate tabs
   * - Avoids page jump when hash changes
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  createHistoryEntry($tab) {
    const $panel = this.getPanel($tab);
    if (!$panel) {
      return;
    }

    // Save and restore the id
    // so the page doesn't jump when a user clicks a tab (which changes the hash)
    const panelId = $panel.id;
    $panel.id = '';
    this.changingHash = true;
    window.location.hash = this.getHref($tab).slice(1);
    $panel.id = panelId;
  }

  /**
   * Handle tab keydown event
   *
   * - Press right/down arrow for next tab
   * - Press left/up arrow for previous tab
   *
   * @private
   * @param {KeyboardEvent} event - Keydown event
   */
  onTabKeydown(event) {
    switch (event.keyCode) {
      case this.keys.left:
      case this.keys.up:
        this.activatePreviousTab();
        event.preventDefault();
        break;
      case this.keys.right:
      case this.keys.down:
        this.activateNextTab();
        event.preventDefault();
        break;
    }
  }

  /**
   * Activate next tab
   *
   * @private
   */
  activateNextTab() {
    const $currentTab = this.getCurrentTab();
    if (!$currentTab || !$currentTab.parentElement) {
      return;
    }
    const $nextTabListItem = $currentTab.parentElement.nextElementSibling;
    if (!$nextTabListItem) {
      return;
    }

    /** @satisfies {HTMLAnchorElement} */
    const $nextTab = $nextTabListItem.querySelector('a.govuk-tabs__tab');
    if (!$nextTab) {
      return;
    }
    this.hideTab($currentTab);
    this.showTab($nextTab);
    $nextTab.focus();
    this.createHistoryEntry($nextTab);
  }

  /**
   * Activate previous tab
   *
   * @private
   */
  activatePreviousTab() {
    const $currentTab = this.getCurrentTab();
    if (!$currentTab || !$currentTab.parentElement) {
      return;
    }
    const $previousTabListItem = $currentTab.parentElement.previousElementSibling;
    if (!$previousTabListItem) {
      return;
    }

    /** @satisfies {HTMLAnchorElement} */
    const $previousTab = $previousTabListItem.querySelector('a.govuk-tabs__tab');
    if (!$previousTab) {
      return;
    }
    this.hideTab($currentTab);
    this.showTab($previousTab);
    $previousTab.focus();
    this.createHistoryEntry($previousTab);
  }

  /**
   * Get tab panel for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   * @returns {Element | null} Tab panel
   */
  getPanel($tab) {
    return this.$module.querySelector(this.getHref($tab));
  }

  /**
   * Show tab panel for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  showPanel($tab) {
    const $panel = this.getPanel($tab);
    if (!$panel) {
      return;
    }
    $panel.classList.remove(this.jsHiddenClass);
  }

  /**
   * Hide tab panel for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  hidePanel($tab) {
    const $panel = this.getPanel($tab);
    if (!$panel) {
      return;
    }
    $panel.classList.add(this.jsHiddenClass);
  }

  /**
   * Unset 'selected' state for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  unhighlightTab($tab) {
    if (!$tab.parentElement) {
      return;
    }
    $tab.setAttribute('aria-selected', 'false');
    $tab.parentElement.classList.remove('govuk-tabs__list-item--selected');
    $tab.setAttribute('tabindex', '-1');
  }

  /**
   * Set 'selected' state for tab link
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   */
  highlightTab($tab) {
    if (!$tab.parentElement) {
      return;
    }
    $tab.setAttribute('aria-selected', 'true');
    $tab.parentElement.classList.add('govuk-tabs__list-item--selected');
    $tab.setAttribute('tabindex', '0');
  }

  /**
   * Get current tab link
   *
   * @private
   * @returns {HTMLAnchorElement | null} Tab link
   */
  getCurrentTab() {
    return this.$module.querySelector('.govuk-tabs__list-item--selected a.govuk-tabs__tab');
  }

  /**
   * Get link hash fragment for href attribute
   *
   * this is because IE doesn't always return the actual value but a relative full path
   * should be a utility function most prob
   * {@link http://labs.thesedays.com/blog/2010/01/08/getting-the-href-value-with-jquery-in-ie/}
   *
   * @private
   * @param {HTMLAnchorElement} $tab - Tab link
   * @returns {string} Hash fragment including #
   */
  getHref($tab) {
    const href = $tab.getAttribute('href');
    const hash = href.slice(href.indexOf('#'), href.length);
    return hash;
  }
}

/* eslint-disable no-new */


/**
 * Initialise all components
 *
 * Use the `data-module` attributes to find, instantiate and init all of the
 * components provided as part of GOV.UK Frontend.
 *
 * @param {Config} [config] - Config for all components
 */
function initAll(config) {
  config = typeof config !== 'undefined' ? config : {};

  // Skip initialisation when GOV.UK Frontend is not supported
  if (!document.body.classList.contains('govuk-frontend-supported')) {
    return;
  }

  // Allow the user to initialise GOV.UK Frontend in only certain sections of the page
  // Defaults to the entire document if nothing is set.
  const $scope = config.scope instanceof HTMLElement ? config.scope : document;
  const $accordions = $scope.querySelectorAll('[data-module="govuk-accordion"]');
  $accordions.forEach($accordion => {
    new Accordion($accordion, config.accordion);
  });
  const $buttons = $scope.querySelectorAll('[data-module="govuk-button"]');
  $buttons.forEach($button => {
    new Button($button, config.button);
  });
  const $characterCounts = $scope.querySelectorAll('[data-module="govuk-character-count"]');
  $characterCounts.forEach($characterCount => {
    new CharacterCount($characterCount, config.characterCount);
  });
  const $checkboxes = $scope.querySelectorAll('[data-module="govuk-checkboxes"]');
  $checkboxes.forEach($checkbox => {
    new Checkboxes($checkbox);
  });

  // Find first error summary module to enhance.
  const $errorSummary = $scope.querySelector('[data-module="govuk-error-summary"]');
  if ($errorSummary) {
    new ErrorSummary($errorSummary, config.errorSummary);
  }
  const $exitThisPageButtons = $scope.querySelectorAll('[data-module="govuk-exit-this-page"]');
  $exitThisPageButtons.forEach($button => {
    new ExitThisPage($button, config.exitThisPage);
  });

  // Find first header module to enhance.
  const $header = $scope.querySelector('[data-module="govuk-header"]');
  if ($header) {
    new Header($header);
  }
  const $notificationBanners = $scope.querySelectorAll('[data-module="govuk-notification-banner"]');
  $notificationBanners.forEach($notificationBanner => {
    new NotificationBanner($notificationBanner, config.notificationBanner);
  });
  const $radios = $scope.querySelectorAll('[data-module="govuk-radios"]');
  $radios.forEach($radio => {
    new Radios($radio);
  });

  // Find first skip link module to enhance.
  const $skipLink = $scope.querySelector('[data-module="govuk-skip-link"]');
  if ($skipLink) {
    new SkipLink($skipLink);
  }
  const $tabs = $scope.querySelectorAll('[data-module="govuk-tabs"]');
  $tabs.forEach($tabs => {
    new Tabs($tabs);
  });
}

/**
 * Config for all components via `initAll()`
 *
 * @typedef {object} Config
 * @property {Element} [scope=document] - Scope to query for components
 * @property {AccordionConfig} [accordion] - Accordion config
 * @property {ButtonConfig} [button] - Button config
 * @property {CharacterCountConfig} [characterCount] - Character Count config
 * @property {ErrorSummaryConfig} [errorSummary] - Error Summary config
 * @property {ExitThisPageConfig} [exitThisPage] - Exit This Page config
 * @property {NotificationBannerConfig} [notificationBanner] - Notification Banner config
 */

/**
 * Config for individual components
 *
 * @typedef {import('./components/accordion/accordion.mjs').AccordionConfig} AccordionConfig
 * @typedef {import('./components/accordion/accordion.mjs').AccordionTranslations} AccordionTranslations
 * @typedef {import('./components/button/button.mjs').ButtonConfig} ButtonConfig
 * @typedef {import('./components/character-count/character-count.mjs').CharacterCountConfig} CharacterCountConfig
 * @typedef {import('./components/character-count/character-count.mjs').CharacterCountConfigWithMaxLength} CharacterCountConfigWithMaxLength
 * @typedef {import('./components/character-count/character-count.mjs').CharacterCountConfigWithMaxWords} CharacterCountConfigWithMaxWords
 * @typedef {import('./components/character-count/character-count.mjs').CharacterCountTranslations} CharacterCountTranslations
 * @typedef {import('./components/error-summary/error-summary.mjs').ErrorSummaryConfig} ErrorSummaryConfig
 * @typedef {import('./components/exit-this-page/exit-this-page.mjs').ExitThisPageConfig} ExitThisPageConfig
 * @typedef {import('./components/exit-this-page/exit-this-page.mjs').ExitThisPageTranslations} ExitThisPageTranslations
 * @typedef {import('./components/notification-banner/notification-banner.mjs').NotificationBannerConfig} NotificationBannerConfig
 */

export { Accordion, Button, CharacterCount, Checkboxes, ErrorSummary, ExitThisPage, Header, NotificationBanner, Radios, SkipLink, Tabs, initAll, version };
//# sourceMappingURL=all.bundle.mjs.map
