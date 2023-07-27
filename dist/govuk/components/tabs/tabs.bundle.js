(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('GOVUKFrontend.Tabs', ['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.GOVUKFrontend = global.GOVUKFrontend || {}, global.GOVUKFrontend.Tabs = {})));
})(this, (function (exports) { 'use strict';

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

  exports.Tabs = Tabs;

}));
//# sourceMappingURL=tabs.bundle.js.map
