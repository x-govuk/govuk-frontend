
/*
  Accordion

  This allows a collection of sections to be collapsed by default,
  showing only their headers. Sections can be expanded or collapsed
  individually by clicking their headers. An "Open all" button is
  also added to the top of the accordion, which switches to "Close all"
  when all the sections are expanded.

  The state of each section is saved to the DOM via the `aria-expanded`
  attribute, which also provides accessibility.

*/

import { nodeListForEach } from '../../common'
import '../../vendor/polyfills/Function/prototype/bind'
import '../../vendor/polyfills/Element/prototype/classList'

function Accordion ($module) {
  this.$module = $module
  this.moduleId = $module.getAttribute('id')
  this.$sections = $module.querySelectorAll('.govuk-accordion__section')
  this.$openAllButton = ''
  this.browserSupportsSessionStorage = helper.checkForSessionStorage()

  this.controlsClass = 'govuk-accordion__controls'
  this.openAllClass = 'govuk-accordion__open-all'
  this.openAllTextClass = 'govuk-accordion__open-all-text'

  this.sectionHeaderClass = 'govuk-accordion__section-header'
  this.sectionHeadingClass = 'govuk-accordion__section-heading'
  this.sectionHeadingClassFocusWrapper = 'govuk-accordion__section-heading-focus-wrapper'
  this.sectionSummaryClass = 'govuk-accordion__section-summary'
  this.sectionButtonClass = 'govuk-accordion__section-button'
  this.sectionExpandedClass = 'govuk-accordion__section--expanded'
  this.sectionInnerContent = 'govuk-accordion__section-content'
  this.toggleLinkClass = 'js-toggle-link'
  this.sectionShowHideIconClass = 'govuk-accordion__toggle-link'
  this.sectionShowHideTextClass = 'govuk-accordion__toggle-text'
  this.upChevronIconClass = 'govuk-accordion-nav__chevron'
  this.downChevronIconClass = 'govuk-accordion-nav__chevron--down'
}

// Initialize component
Accordion.prototype.init = function () {
  // Check for module
  if (!this.$module) {
    return
  }

  this.initControls()
  this.initSectionHeaders()

  // See if "Show all sections" button text should be updated
    var areAllSectionsOpen = this.checkIfAllSectionsOpen()
    this.updateOpenAllButton(areAllSectionsOpen)
}

// Initialise controls and set attributes
Accordion.prototype.initControls = function () {
  // Create "Show all" button and set attributes
  this.$openAllButton = document.createElement('button')
  this.$openAllButton.setAttribute('class', this.openAllClass)
  this.$openAllButton.setAttribute('aria-expanded', 'false')

  // Create icon, add to element
  var icon = document.createElement('span')
  icon.classList.add(this.upChevronIconClass)
  this.$openAllButton.appendChild(icon)

  // Create control wrapper and add controls to it
  var accordionControls = document.createElement('div')
  accordionControls.setAttribute('class', this.controlsClass)
  accordionControls.appendChild(this.$openAllButton)
  this.$module.insertBefore(accordionControls, this.$module.firstChild)

  // Build additional wrapper for open all toggle text, place icon before wrapped text.
  var wrapperOpenAllText = document.createElement('span')
  wrapperOpenAllText.classList.add(this.openAllTextClass)
  this.$openAllButton.appendChild(wrapperOpenAllText)

  // Handle events for the controls
  this.$openAllButton.addEventListener('click', this.onOpenOrCloseAllToggle.bind(this))
}

// Initialise section headers
Accordion.prototype.initSectionHeaders = function () {
  // Loop through section headers
  nodeListForEach(this.$sections, function ($section, i) {
    // Set header attributes
    var header = $section.querySelector('.' + this.sectionHeaderClass)
    this.initHeaderAttributes(header, i)
    this.setExpanded(this.isExpanded($section), $section)

    // Handle events
    header.addEventListener('click', this.onSectionToggle.bind(this, $section))

    // See if there is any state stored in sessionStorage and set the sections to
    // open or closed.
    this.setInitialState($section)
  }.bind(this))
}

// Set individual header attributes
Accordion.prototype.initHeaderAttributes = function ($headerWrapper, index) {
  var $module = this
  var $span = $headerWrapper.querySelector('.' + this.sectionButtonClass)
  var $heading = $headerWrapper.querySelector('.' + this.sectionHeadingClass)
  var $summary = $headerWrapper.querySelector('.' + this.sectionSummaryClass)

  // Copy existing span element to an actual button element, for improved accessibility.
  var $button = document.createElement('button')
  $button.setAttribute('id', this.moduleId + '-heading-' + (index + 1))
  $button.setAttribute('aria-controls', this.moduleId + '-content-' + (index + 1))

  // Create show / hide arrow icons with text.
  var showIcons = document.createElement('span')
  showIcons.classList.add(this.sectionShowHideIconClass, this.toggleLinkClass)

  // Wrapper header to receive focus state design
  var $wrapperFocusHeading = document.createElement('span')
  $wrapperFocusHeading.classList.add(this.sectionHeadingClassFocusWrapper)

  // Add pause after heading for assistive technology.
  var $srPause = document.createElement('span')
  $srPause.classList.add('govuk-visually-hidden')
  $srPause.innerHTML = ', '

  // Build additional copy for assistive technology
  var srAdditionalCopy = document.createElement('span')
  srAdditionalCopy.classList.add('govuk-visually-hidden')
  srAdditionalCopy.innerHTML = ' this section'

  // Build additional wrapper for toggle text, place icon before wrapped text.
  var wrapperShowHideIcon = document.createElement('span')
  var icon = document.createElement('span')
  icon.classList.add(this.upChevronIconClass)
  showIcons.appendChild(icon)
  wrapperShowHideIcon.classList.add(this.sectionShowHideTextClass)
  showIcons.appendChild(wrapperShowHideIcon)

  // Copy all attributes (https://developer.mozilla.org/en-US/docs/Web/API/Element/attributes) from $span to $button
  for (var i = 0; i < $span.attributes.length; i++) {
    var attr = $span.attributes.item(i)
    $button.setAttribute(attr.nodeName, attr.nodeValue)
  }

  // span could contain HTML elements (see https://www.w3.org/TR/2011/WD-html5-20110525/content-models.html#phrasing-content)
  $heading.removeChild($span)
  $heading.appendChild($button)
  $button.appendChild($wrapperFocusHeading)
  $wrapperFocusHeading.innerHTML = $span.innerHTML
  $button.appendChild($srPause)

  // If summary content exists add to DOM in correct order
  if (typeof ($summary) !== 'undefined' && $summary !== null) {
    $button.setAttribute('aria-describedby', this.moduleId + '-summary-' + (index + 1))
    $button.appendChild($summary)
  }

  $button.appendChild(showIcons)
  $button.appendChild(srAdditionalCopy)
}

// When section toggled, set and store state
Accordion.prototype.onSectionToggle = function ($section) {
  var expanded = this.isExpanded($section)
  this.setExpanded(!expanded, $section)

  // Store the state in sessionStorage when a change is triggered
  this.storeState($section)
}

// When Open/Close All toggled, set and store state
Accordion.prototype.onOpenOrCloseAllToggle = function () {
  var $module = this
  var $sections = this.$sections
  var nowExpanded = !this.checkIfAllSectionsOpen()

  nodeListForEach($sections, function ($section) {
    $module.setExpanded(nowExpanded, $section)
    // Store the state in sessionStorage when a change is triggered
    $module.storeState($section)
  })

  $module.updateOpenAllButton(nowExpanded)
}

// Set section attributes when opened/closed
Accordion.prototype.setExpanded = function (expanded, $section) {
  var $icon = $section.querySelector('.' + this.upChevronIconClass)
  var $showHideText = $section.querySelector('.' + this.sectionShowHideTextClass)
  var $button = $section.querySelector('.' + this.sectionButtonClass)
  var $newButtonText = expanded ? 'Hide' : 'Show'

  $showHideText.innerHTML = $newButtonText
  $button.setAttribute('aria-expanded', expanded)
  $button.classList.add(this.toggleLinkClass)

  // Swap icon, change class
  if (expanded) {
    $section.classList.add(this.sectionExpandedClass)
    $icon.classList.remove(this.downChevronIconClass)
  } else {
    $section.classList.remove(this.sectionExpandedClass)
    $icon.classList.add(this.downChevronIconClass)
  }

  // See if "Show all sections" button text should be updated
  var areAllSectionsOpen = this.checkIfAllSectionsOpen()
  this.updateOpenAllButton(areAllSectionsOpen)
}

// Get state of section
Accordion.prototype.isExpanded = function ($section) {
  return $section.classList.contains(this.sectionExpandedClass)
}

// Check if all sections are open
Accordion.prototype.checkIfAllSectionsOpen = function () {
  // Get a count of all the Accordion sections
  var sectionsCount = this.$sections.length
  // Get a count of all Accordion sections that are expanded
  var expandedSectionCount = this.$module.querySelectorAll('.' + this.sectionExpandedClass).length
  var areAllSectionsOpen = sectionsCount === expandedSectionCount

  return areAllSectionsOpen
}

// Update "Show all sections" button
Accordion.prototype.updateOpenAllButton = function (expanded) {
  var $icon = this.$openAllButton.querySelector('.' + this.upChevronIconClass)
  var $openAllCopy = this.$openAllButton.querySelector('.' + this.openAllTextClass)
  var newButtonText = expanded ? 'Hide all sections' : 'Show all sections'
  this.$openAllButton.setAttribute('aria-expanded', expanded)
  $openAllCopy.innerHTML = newButtonText

  // Swap icon, toggle class
  if (expanded) {
    $icon.classList.remove(this.downChevronIconClass)
  } else {
    $icon.classList.add(this.downChevronIconClass)
  }
}

// Check for `window.sessionStorage`, and that it actually works.
var helper = {
  checkForSessionStorage: function () {
    var testString = 'this is the test string'
    var result
    try {
      window.sessionStorage.setItem(testString, testString)
      result = window.sessionStorage.getItem(testString) === testString.toString()
      window.sessionStorage.removeItem(testString)
      return result
    } catch (exception) {
      if ((typeof console === 'undefined' || typeof console.log === 'undefined')) {
        console.log('Notice: sessionStorage not available.')
      }
    }
  }
}

// Set the state of the accordions in sessionStorage
Accordion.prototype.storeState = function ($section) {
  if (this.browserSupportsSessionStorage) {
    // We need a unique way of identifying each content in the Accordion. Since
    // an `#id` should be unique and an `id` is required for `aria-` attributes
    // `id` can be safely used.
    var $button = $section.querySelector('.' + this.sectionButtonClass)

    if ($button) {
      var contentId = $button.getAttribute('aria-controls')
      var contentState = $button.getAttribute('aria-expanded')

      if (typeof contentId === 'undefined' && (typeof console === 'undefined' || typeof console.log === 'undefined')) {
        console.error(new Error('No aria controls present in accordion section heading.'))
      }

      if (typeof contentState === 'undefined' && (typeof console === 'undefined' || typeof console.log === 'undefined')) {
        console.error(new Error('No aria expanded present in accordion section heading.'))
      }

      // Only set the state when both `contentId` and `contentState` are taken from the DOM.
      if (contentId && contentState) {
        window.sessionStorage.setItem(contentId, contentState)
      }
    }
  }
}

// Read the state of the accordions from sessionStorage
Accordion.prototype.setInitialState = function ($section) {
  if (this.browserSupportsSessionStorage) {
    var $button = $section.querySelector('.' + this.sectionButtonClass)

    if ($button) {
      var contentId = $button.getAttribute('aria-controls')
      var contentState = contentId ? window.sessionStorage.getItem(contentId) : null

      if (contentState !== null) {
        this.setExpanded(contentState === 'true', $section)
      }
    }
  }
}


export default Accordion
