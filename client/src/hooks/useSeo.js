import { useEffect } from 'react'

const SITE_NAME = 'History Arrow'
const SITE_URL = 'https://history-arrow.yanick-christen.com'

function setMetaByName(name, content) {
  if (!content) return
  let tag = document.querySelector(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setMetaByProperty(property, content) {
  if (!content) return
  let tag = document.querySelector(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setCanonical(url) {
  if (!url) return
  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

export function useSeo({
  title,
  description,
  path = '/',
  robots = 'index, follow'
}) {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path}`
    const pageTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}`

    document.title = pageTitle
    setMetaByName('description', description)
    setMetaByName('robots', robots)
    setMetaByName('twitter:card', 'summary_large_image')
    setMetaByName('twitter:title', pageTitle)
    setMetaByName('twitter:description', description)

    setMetaByProperty('og:type', 'website')
    setMetaByProperty('og:site_name', SITE_NAME)
    setMetaByProperty('og:title', pageTitle)
    setMetaByProperty('og:description', description)
    setMetaByProperty('og:url', canonicalUrl)

    setCanonical(canonicalUrl)
  }, [title, description, path, robots])
}
