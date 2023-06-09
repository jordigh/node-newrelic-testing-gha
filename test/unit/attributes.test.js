/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../lib/agent_helper')
const { Attributes } = require('../../lib/attributes')
const AttributeFilter = require('../../lib/config/attribute-filter')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const TRANSACTION_SCOPE = 'transaction'

tap.test('#addAttribute', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('adds an attribute to instance', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE)
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'test', 'success')
    const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)

    t.equal(attributes.test, 'success')

    t.end()
  })

  t.test('does not add attribute if key length limit is exceeded', (t) => {
    const tooLong = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
      'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
      'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
    ].join(' ')

    const inst = new Attributes(TRANSACTION_SCOPE)
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, tooLong, 'will fail')
    const attributes = Object.keys(inst.attributes)

    t.equal(attributes.length, 0)

    t.end()
  })
})

tap.test('#addAttributes', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('adds multiple attributes to instance', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE)
    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, { one: '1', two: '2' })
    const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)

    t.equal(attributes.one, '1')
    t.equal(attributes.two, '2')

    t.end()
  })

  t.test('only allows non-null-type primitive attribute values', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE, 10)
    const attributes = {
      first: 'first',
      second: ['second'],
      third: { key: 'third' },
      fourth: 4,
      fifth: true,
      sixth: undefined,
      seventh: null,
      eighth: Symbol('test'),
      ninth: function () {}
    }

    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, attributes)

    const res = inst.get(DESTINATIONS.TRANS_SCOPE)
    t.equal(Object.keys(res).length, 3)

    const hasAttribute = Object.hasOwnProperty.bind(res)
    t.notOk(hasAttribute('second'))
    t.notOk(hasAttribute('third'))
    t.notOk(hasAttribute('sixth'))
    t.notOk(hasAttribute('seventh'))
    t.notOk(hasAttribute('eighth'))
    t.notOk(hasAttribute('ninth'))

    t.end()
  })

  t.test('disallows adding more than maximum allowed attributes', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE, 3)
    const attributes = {
      first: 1,
      second: 2,
      portishead: 3,
      so: 4
    }

    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, attributes)
    const res = inst.get(DESTINATIONS.TRANS_SCOPE)

    t.equal(Object.keys(res).length, 3)

    t.end()
  })

  t.test('Overwrites value of added attribute with same key', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE, 2)
    inst.addAttribute(0x01, 'Roboto', 1)
    inst.addAttribute(0x01, 'Roboto', 99)

    const res = inst.get(0x01)

    t.equal(Object.keys(res).length, 1)
    t.equal(res.Roboto, 99)

    t.end()
  })
})

tap.test('#get', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('gets attributes by destination, truncating values if necessary', (t) => {
    const longVal = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
      'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
      'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    ].join(' ')

    const inst = new Attributes(TRANSACTION_SCOPE)
    inst.addAttribute(0x01, 'valid', 50)
    inst.addAttribute(0x01, 'tooLong', longVal)
    inst.addAttribute(0x08, 'wrongDest', 'hello')

    t.ok(Buffer.byteLength(longVal) > 255)

    const res = inst.get(0x01)
    t.equal(res.valid, 50)

    t.equal(Buffer.byteLength(res.tooLong), 255)

    t.end()
  })

  t.test('only returns attributes up to specified limit', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE, 2)
    inst.addAttribute(0x01, 'first', 'first')
    inst.addAttribute(0x01, 'second', 'second')
    inst.addAttribute(0x01, 'third', 'third')

    const res = inst.get(0x01)
    const hasAttribute = Object.hasOwnProperty.bind(res)

    t.equal(Object.keys(res).length, 2)
    t.notOk(hasAttribute('third'))

    t.end()
  })
})

tap.test('#hasValidDestination', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should return true if single destination valid', (t) => {
    const attributes = new Attributes(TRANSACTION_SCOPE)
    const hasDestination = attributes.hasValidDestination(DESTINATIONS.TRANS_EVENT, 'testAttr')

    t.equal(hasDestination, true)
    t.end()
  })

  t.test('should return true if all destinations valid', (t) => {
    const attributes = new Attributes(TRANSACTION_SCOPE)
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, 'testAttr')

    t.equal(hasDestination, true)
    t.end()
  })

  t.test('should return true if only one destination valid', (t) => {
    const attributeName = 'testAttr'
    agent.config.transaction_events.attributes.exclude = [attributeName]
    agent.config.emit('transaction_events.attributes.exclude')

    const attributes = new Attributes(TRANSACTION_SCOPE)
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, attributeName)

    t.equal(hasDestination, true)
    t.end()
  })

  t.test('should return false if no valid destinations', (t) => {
    const attributeName = 'testAttr'
    agent.config.attributes.exclude = [attributeName]
    agent.config.emit('attributes.exclude')

    const attributes = new Attributes(TRANSACTION_SCOPE)
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, attributeName)

    t.equal(hasDestination, false)
    t.end()
  })
})

tap.test('#reset', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('resets instance attributes', (t) => {
    const inst = new Attributes(TRANSACTION_SCOPE)
    inst.addAttribute(0x01, 'first', 'first')
    inst.addAttribute(0x01, 'second', 'second')
    inst.addAttribute(0x01, 'third', 'third')

    inst.reset()

    t.same(inst.attributes, {})

    t.end()
  })
})
