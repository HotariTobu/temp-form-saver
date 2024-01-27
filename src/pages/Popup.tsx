import { Button } from "@/components/ui/button";
import { useState } from "react";

import browser from "webextension-polyfill";

const t = browser.i18n.getMessage

const getCurrentTab = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  return tab
}

const getCurrentTabId = async () => {
  const tab = await getCurrentTab()
  return tab?.id ?? null;
}

const injectScript = async () => {
  const tabId = await getCurrentTabId()
  if (tabId === null) {
    return
  }

  const results = await browser.scripting.executeScript({
    target: {
      tabId,
    },
    files: ['src/scripts/form.js'],
  })

  return results
}

const include = (tabUrl: URL, shotUrl: URL) => {
  return tabUrl.origin === shotUrl.origin
}

const getShotMap = async () => {
  const tab = await getCurrentTab()
  const url = tab.url
  if (typeof url === 'undefined') {
    return null
  }

  const tabUrl = new URL(url)

  const pairs = await browser.storage.local.get()
  const shotMap = new Map(
    Array.from(Object.entries(pairs))
      .filter(pair => {
        const shot: Shot = pair[1]
        const shotUrl = new URL(shot.url)
        return include(tabUrl, shotUrl)
      })
      .map(([time, shot]) => {
        return [
          parseInt(time),
          shot as Shot,
        ]
      })
  )

  return shotMap
}

const sendMessage = async (request: Message) => {
  const tabId = await getCurrentTabId()
  if (tabId === null) {
    return null
  }

  const response: Message = await browser.tabs.sendMessage(tabId, request)
  return response
}

const timeToString = (time: number) => {
  const dif = Date.now() - time

  if (dif < 60 * 1000) {
    return t('seconds_ago', (dif / 1000).toFixed())
  }

  if (dif < 60 * 60 * 1000) {
    return t('minutes_ago', (dif / 60 / 1000).toFixed())
  }

  if (dif < 24 * 60 * 60 * 1000) {
    return t('hours_ago', (dif / 60 / 60 / 1000).toFixed())
  }

  if (dif < 7 * 24 * 60 * 60 * 1000) {
    return t('days_ago', (dif / 24 / 60 / 60 / 1000).toFixed())
  }

  return new Date(time).toLocaleString()
}

injectScript()

const initialShotMap = await getShotMap()
if (initialShotMap === null) {
  throw new Error('null: initialShotMap')
}

export default function () {
  const [shotMap, setShots] = useState(
    initialShotMap ?? new Map<number, Shot>()
  )

  const save = async () => {
    const result = await sendMessage({
      meta: 'get',
    })

    const value = result?.value
    if (typeof value === 'undefined') {
      return
    }

    const tab = await getCurrentTab()
    const url = tab.url
    if (typeof url === 'undefined') {
      return
    }

    const data = JSON.parse(value)
    if (!Array.isArray(data)) {
      return
    }

    const time = Date.now()
    const shot = {
      url,
      data,
    }

    const key = time.toString()
    browser.storage.local.set({
      [key]: shot,
    })

    setShots(new Map([
      ...shotMap.entries(),
      [time, shot],
    ]))
  }

  const restore = (time: number) => {
    const shot = shotMap.get(time)
    if (typeof shot === 'undefined') {
      return
    }

    const value = JSON.stringify(shot.data)
    sendMessage({
      meta: 'set',
      value,
    })
  }

  const remove = (time: number) => {
    const key = time.toString()
    browser.storage.local.remove(key)

    const entries = Array.from(shotMap)
    setShots(new Map(
      entries.filter(e => e[0] != time)
    ))
  }

  return (
    <div className="w-[300px]">
      <Button onClick={save}>{t('save')}</Button>

      <div className="max-h-[400px] overflow-y-auto">
        {Array.from(shotMap.keys()).reverse().map((time) => (
          <div className="flex" key={time}>
            {timeToString(time)}
            <Button onClick={() => restore(time)}>F</Button>
            <Button onClick={() => remove(time)}>R</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
