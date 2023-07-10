const { render } = require('govuk-frontend-helpers/nunjucks')
const { getExamples } = require('govuk-frontend-lib/files')

describe('Task List', () => {
  let examples

  beforeAll(async () => {
    examples = await getExamples('task-list')
  })

  it('renders the default example', () => {
    const $ = render('task-list', examples.default)

    const $component = $('.govuk-task-list')
    expect($component.get(0).tagName).toEqual('ul')
  })

  it('allows for custom classes on the root of the component', () => {
    const $ = render('task-list', examples['custom classes'])

    const $component = $('.govuk-task-list')
    expect($component.hasClass('custom-class-on-component')).toBeTruthy()
  })

  it('allows for custom classes on each task', () => {
    const $ = render('task-list', examples['custom classes'])

    const $listItem = $('.govuk-task-list__item')
    expect($listItem.hasClass('custom-class-on-task')).toBeTruthy()
  })

  it('allows for custom classes on each status', () => {
    const $ = render('task-list', examples['custom classes'])

    const $status = $('.govuk-task-list__status')
    expect($status.hasClass('custom-class-on-status')).toBeTruthy()
  })

  it('allows for custom classes on tags', () => {
    const $ = render('task-list', examples['custom classes'])

    const $tag = $('.govuk-task-list__status .govuk-tag')
    expect($tag.hasClass('custom-class-on-tag')).toBeTruthy()
  })

  describe('when a task has an href set', () => {
    let $component

    beforeAll(function () {
      const $ = render('task-list', examples.default)
      $component = $('.govuk-task-list')
    })

    it('wraps the task title in a link', async () => {
      const $itemLink = $component.find('a.govuk-task-list__link')
      expect($itemLink.attr('href')).toEqual('#')
    })

    it('associates the task name link with the status using aria', async () => {
      const $itemLink = $component.find('.govuk-task-list__link')
      const $statusWithId = $component.find(`#${$itemLink.attr('aria-describedby')}`)

      expect($statusWithId.text()).toContain('Completed')
    })

    it('applies title classes to the link', () => {
      const $ = render('task-list', examples['custom classes'])

      const $itemWithLink = $('.govuk-task-list__item:first-child')
      const $itemWithLinkTitle = $itemWithLink.find('.govuk-task-list__link')
      expect($itemWithLinkTitle.hasClass('custom-class-on-linked-title')).toBeTruthy()
    })
  })

  describe('when a task does not have an href set', () => {
    it('does not link the task title', () => {
      const $ = render('task-list', examples['example with hint text and additional states'])

      const $itemWithNoLink = $('.govuk-task-list__item:last-child')
      const $itemWithNoLinkTitle = $itemWithNoLink.find('div')
      expect($itemWithNoLinkTitle.text()).toContain('Payment')
    })

    it('applies title classes to the title wrapper div', () => {
      const $ = render('task-list', examples['custom classes'])

      const $itemWithNoLink = $('.govuk-task-list__item:last-child')
      const $itemWithNoLinkTitle = $itemWithNoLink.find('.govuk-task-list__task-name-and-hint div')
      expect($itemWithNoLinkTitle.hasClass('custom-class-on-unlinked-title')).toBeTruthy()
    })
  })

  describe('when a task has a hint', () => {
    let $component

    beforeAll(function () {
      const $ = render('task-list', examples['example with hint text and additional states'])
      $component = $('.govuk-task-list')
    })

    it('renders the hint', () => {
      const $hintText = $component.find('.govuk-task-list__task_hint')
      expect($hintText.text()).toContain(
        'Ensure the plan covers objectives, strategies, sales, marketing and financial forecasts.'
      )
    })

    it('associates the hint text with the task link using aria', () => {
      const $hintText = $component.find('.govuk-task-list__task_hint')
      expect($hintText.attr('id')).toEqual('task-list-example-3-hint')

      const $itemAssociatedWithHint = $component.find(
        `.govuk-task-list__link[aria-describedby~="${$hintText.attr('id')}"]`
      )
      expect($itemAssociatedWithHint.text()).toContain('Business plan')
    })
  })
})