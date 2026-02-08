// DOM helper functions

// Create an element with optional attributes and children
export const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag)

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else {
      el.appendChild(child)
    }
  }

  return el
}

// Shorthand for querySelector that throws if not found
export const qs = <T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T => {
  const el = parent.querySelector<T>(selector)
  if (!el) {
    throw new Error(`Element not found: ${selector}`)
  }
  return el
}

// Clear all children of an element
export const clearChildren = (el: HTMLElement): void => {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}
