import browser from "webextension-polyfill";

const t = browser.i18n.getMessage

const flagName = t('extension_name') + '_script_injected'
if (document.querySelector(`meta[name="${flagName}"]`) !== null) {
  throw null
}

const flagMeta = document.createElement('meta')
flagMeta.name = flagName
document.head.appendChild(flagMeta)

const getValue = (element: HTMLInputElement) => {
  const type = element.type
  switch (type) {
    case 'checkbox':
    case 'radio':
      return element.checked ? 't' : 'f'
  }

  if (element instanceof HTMLSelectElement) {
    const options = element.selectedOptions
    const values = Array.from(options).map(o => o.value)
    return JSON.stringify(values)
  }

  return element.value
}

const setValue = (element: HTMLInputElement, value: string) => {
  const type = element.type
  switch (type) {
    case 'checkbox':
    case 'radio':
      element.checked = value === 't'
      return
  }

  if (element instanceof HTMLSelectElement) {
    const values = JSON.parse(value)
    const valueSet = new Set(values)

    for (const option of element.options) {
      if (valueSet.has(option.value)) {
        option.selected = true
      }
    }

    return
  }

  element.value = value
}

const isHiddenStyle = (style: CSSStyleDeclaration) => {
  return style.display === 'none' ||
    parseFloat(style.opacity) < 0.01
}

const isHiddenElement = (element: HTMLInputElement) => {
  return element.type === 'hidden' ||
    element.hasAttribute('hidden') ||
    isHiddenStyle(getComputedStyle(element))
}

const getElements = () => {
  const elements = document.querySelectorAll<HTMLInputElement>('input, select, textarea')
  return Array.from(elements).filter(e => !isHiddenElement(e))
}

const getFormData = (): Item[] => {
  const elements = getElements()

  const preprocess = (value: string) => {
    if (value.length > 0) {
      return value
    }
  }

  const data = elements.map(element => {
    return {
      id: preprocess(element.id),
      name: preprocess(element.name),
      value: preprocess(getValue(element)),
    }
  })

  return data
}

const setFormData = (data: Item[]) => {
  const elements = getElements()

  if (
    data.length !== elements.length
    &&
    !confirm(t('continue_even_not_same_form'))
  ) {
    return
  }

  const length = data.length < elements.length ? data.length : elements.length
  const specified: { query: string, value: string }[] = []

  for (let index = 0; index < length; index++) {
    const { id, name, value } = data[index]
    if (typeof value === 'undefined') {
      continue
    }

    const element = elements[index]
    setValue(element, value)

    let query = ''

    if (typeof id === 'string') {
      query += `#${id}`
    }

    if (typeof name === 'string') {
      query += `[name="${name}"]`
    }

    if (element.type === 'radio') {
      query += `[value="${value}"]`
    }

    if (query.length > 0) {
      specified.push({
        query,
        value,
      })
    }
  }

  for (const { query, value } of specified) {
    const element = document.querySelector(query)
    if (element instanceof HTMLInputElement) {
      setValue(element, value)
    }
  }
}

const handleMessage = async (message: Message): Promise<Message> => {
  switch (message.meta) {
    case 'get': {
      const data = getFormData()
      return {
        meta: 'ok',
        value: JSON.stringify(data)
      }
    }
    case 'set': {
      if (typeof message.value === 'undefined') {
        break
      }
      const data = JSON.parse(message.value)
      setFormData(data)
      return {
        meta: 'ok'
      }
    }
  }

  return {
    meta: 'bad-meta',
  }
}

browser.runtime.onMessage.addListener(handleMessage)
