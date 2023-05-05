import { version } from './common/govuk-frontend-version.mjs';
export { version } from './common/govuk-frontend-version.mjs';
import Accordion from './components/accordion/accordion.mjs';
export { default as Accordion } from './components/accordion/accordion.mjs';
import Button from './components/button/button.mjs';
export { default as Button } from './components/button/button.mjs';
import CharacterCount from './components/character-count/character-count.mjs';
export { default as CharacterCount } from './components/character-count/character-count.mjs';
import Checkboxes from './components/checkboxes/checkboxes.mjs';
export { default as Checkboxes } from './components/checkboxes/checkboxes.mjs';
import Details from './components/details/details.mjs';
export { default as Details } from './components/details/details.mjs';
import ErrorSummary from './components/error-summary/error-summary.mjs';
export { default as ErrorSummary } from './components/error-summary/error-summary.mjs';
import Header from './components/header/header.mjs';
export { default as Header } from './components/header/header.mjs';
import NotificationBanner from './components/notification-banner/notification-banner.mjs';
export { default as NotificationBanner } from './components/notification-banner/notification-banner.mjs';
import Radios from './components/radios/radios.mjs';
export { default as Radios } from './components/radios/radios.mjs';
import SkipLink from './components/skip-link/skip-link.mjs';
export { default as SkipLink } from './components/skip-link/skip-link.mjs';
import Tabs from './components/tabs/tabs.mjs';
export { default as Tabs } from './components/tabs/tabs.mjs';
import './common/index.mjs';
import './common/normalise-dataset.mjs';
import './i18n.mjs';
import './vendor/polyfills/Element/prototype/classList.mjs';
import './vendor/polyfills/DOMTokenList.mjs';
import './vendor/polyfills/Element/prototype/closest.mjs';
import './vendor/polyfills/Element/prototype/matches.mjs';
import './common/closest-attribute-value.mjs';

/**
 * Initialise all components
 *
 * Use the `data-module` attributes to find, instantiate and init all of the
 * components provided as part of GOV.UK Frontend.
 *
 * @param {Config} [config] - Config for all components
 */
function initAll (config) {
  config = typeof config !== 'undefined' ? config : {};

  // Allow the user to initialise GOV.UK Frontend in only certain sections of the page
  // Defaults to the entire document if nothing is set.
  var $scope = config.scope instanceof HTMLElement ? config.scope : document;

  var $accordions = $scope.querySelectorAll('[data-module="govuk-accordion"]');
  $accordions.forEach(function ($accordion) {
    new Accordion($accordion, config.accordion).init();
  });

  var $buttons = $scope.querySelectorAll('[data-module="govuk-button"]');
  $buttons.forEach(function ($button) {
    new Button($button, config.button).init();
  });

  var $characterCounts = $scope.querySelectorAll('[data-module="govuk-character-count"]');
  $characterCounts.forEach(function ($characterCount) {
    new CharacterCount($characterCount, config.characterCount).init();
  });

  var $checkboxes = $scope.querySelectorAll('[data-module="govuk-checkboxes"]');
  $checkboxes.forEach(function ($checkbox) {
    new Checkboxes($checkbox).init();
  });

  var $details = $scope.querySelectorAll('[data-module="govuk-details"]');
  $details.forEach(function ($detail) {
    new Details($detail).init();
  });

  // Find first error summary module to enhance.
  var $errorSummary = $scope.querySelector('[data-module="govuk-error-summary"]');
  if ($errorSummary) {
    new ErrorSummary($errorSummary, config.errorSummary).init();
  }

  // Find first header module to enhance.
  var $header = $scope.querySelector('[data-module="govuk-header"]');
  if ($header) {
    new Header($header).init();
  }

  var $notificationBanners = $scope.querySelectorAll('[data-module="govuk-notification-banner"]');
  $notificationBanners.forEach(function ($notificationBanner) {
    new NotificationBanner($notificationBanner, config.notificationBanner).init();
  });

  var $radios = $scope.querySelectorAll('[data-module="govuk-radios"]');
  $radios.forEach(function ($radio) {
    new Radios($radio).init();
  });

  // Find first skip link module to enhance.
  var $skipLink = $scope.querySelector('[data-module="govuk-skip-link"]');
  if ($skipLink) {
    new SkipLink($skipLink).init();
  }

  var $tabs = $scope.querySelectorAll('[data-module="govuk-tabs"]');
  $tabs.forEach(function ($tabs) {
    new Tabs($tabs).init();
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
 * @typedef {import('./components/notification-banner/notification-banner.mjs').NotificationBannerConfig} NotificationBannerConfig
 */

export { initAll };
//# sourceMappingURL=all.mjs.map
