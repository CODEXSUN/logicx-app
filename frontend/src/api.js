function getCsrfToken() {
  return window.csrf_token || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': getCsrfToken(),
      ...options.headers,
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload.exception || payload.message || `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload.data ?? payload.message ?? payload
}

const productFields = [
  'name',
  'item',
  'item_source',
  'product_name',
  'short_description',
  'description',
  'enabled',
  'item_group',
  'collections',
  'ranking',
  'image',
  'has_variants',
  'price',
  'compare_at_price',
  'opening_stock',
  'highlights',
  'modified',
]

const productFieldsQuery = encodeURIComponent(JSON.stringify(productFields))
const generalMasterFields = ['name', 'type', 'master_name', 'description', 'active', 'tag', 'modified']
const generalMasterResource = '/api/resource/General%20Master'

export const generalMasterApi = {
  async heads() {
    const records = await generalMasterApi.list()
    return [...new Set(records
      .filter(record => String(record.type ?? '').trim().toLowerCase() === 'type')
      .map(record => String(record.master_name ?? '').trim())
      .filter(Boolean))]
  },
  async list() {
    const records = []
    const fields = encodeURIComponent(JSON.stringify(generalMasterFields))
    for (let start = 0; ; start += 500) {
      const page = await request(`${generalMasterResource}?fields=${fields}&order_by=modified%20desc&limit_start=${start}&limit_page_length=500`)
      records.push(...page)
      if (page.length < 500) return records
    }
  },
  get(name) {
    return request(`${generalMasterResource}/${encodeURIComponent(name)}`)
  },
  save(name, values) {
    const data = {
      type: values.type.trim(), master_name: values.master_name.trim(),
      description: values.description.trim(), active: values.active === 'Active' ? 1 : 0, tag: values.tag.trim(),
    }
    return request(name ? `${generalMasterResource}/${encodeURIComponent(name)}` : generalMasterResource, {
      method: name ? 'PUT' : 'POST', body: JSON.stringify(data),
    })
  },
  deactivate(name) {
    return request(`${generalMasterResource}/${encodeURIComponent(name)}`, {
      method: 'PUT', body: JSON.stringify({ active: 0 }),
    })
  },
}
const productMethod = '/api/method/logicx_app.logicx.doctype.logicx_product.logicx_product'

export const productApi = {
  list() {
    return request(`/api/resource/LogicX%20Product?fields=${productFieldsQuery}&order_by=ranking%20desc%2Cmodified%20desc&limit_page_length=200`)
  },
  get(name) {
    return request(`/api/resource/LogicX%20Product/${encodeURIComponent(name)}?fields=${productFieldsQuery}`)
  },
  items() {
    const itemFields = encodeURIComponent(
      JSON.stringify(['name', 'item_name', 'item_group', 'description', 'image', 'has_variants', 'standard_rate']),
    )
    const filters = encodeURIComponent(JSON.stringify([['Item', 'disabled', '=', 0]]))
    return request(`/api/resource/Item?fields=${itemFields}&filters=${filters}&order_by=item_name%20asc&limit_page_length=500`)
  },
  createNew(product) {
    return request(`${productMethod}.create_new_product`, { method: 'POST', body: JSON.stringify({ product }) })
  },
  linkExisting(item, product) {
    return request(`${productMethod}.link_existing_item`, {
      method: 'POST',
      body: JSON.stringify({ item, product }),
    })
  },
  update(name, data) {
    return request(`/api/resource/LogicX%20Product/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) })
  },
  remove(name) {
    return request(`/api/resource/LogicX%20Product/${encodeURIComponent(name)}`, { method: 'DELETE' })
  },
  async uploadImage(file) {
    const form = new FormData()
    form.append('file', file)
    form.append('is_private', '0')
    form.append('folder', 'Home/Attachments')
    const response = await fetch('/api/method/upload_file', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
      headers: { 'X-Frappe-CSRF-Token': getCsrfToken() },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.exception || payload.message || `Upload failed (${response.status})`)
    return payload.message?.file_url || payload.file_url
  },
}

export const sessionApi = {
  async currentUser() {
    const email = await request('/api/method/frappe.auth.get_logged_user')
    const fallbackName = email === 'Administrator' ? 'Administrator' : email.split('@')[0]
    try {
      const user = await request(
        `/api/resource/User/${encodeURIComponent(email)}?fields=${encodeURIComponent(JSON.stringify(['full_name', 'user_image']))}`,
      )
      const name = user.full_name || fallbackName
      return { email, name, avatarSrc: user.user_image || '', fallback: initials(name) }
    } catch {
      return { email, name: fallbackName, avatarSrc: '', fallback: initials(fallbackName) }
    }
  },
  logout() {
    return request('/api/method/logout', { method: 'POST' })
  },
}

export const globalSearchApi = {
  search(text, limit = 20) {
    const params = new URLSearchParams({ text, start: '0', limit: String(limit) })
    return request(`/api/method/frappe.utils.global_search.search?${params}`)
  },
}

const notificationMethod = '/api/method/frappe.desk.doctype.notification_log.notification_log'

export const notificationApi = {
  async list(limit = 20) {
    return request(`${notificationMethod}.get_notification_logs?limit=${limit}`)
  },
  markRead(docname) {
    return request(`${notificationMethod}.mark_as_read`, {
      method: 'POST',
      body: JSON.stringify({ docname }),
    })
  },
  markAllRead() {
    return request(`${notificationMethod}.mark_all_as_read`, { method: 'POST' })
  },
}

const updateMethod = '/api/method/logicx_app.update'

export const updateApi = {
  status(refresh = true) {
    return request(`${updateMethod}.get_update_status?refresh=${refresh ? 1 : 0}`)
  },
  start() {
    return request(`${updateMethod}.start_update`, { method: 'POST' })
  },
  maintain() {
    return request(`${updateMethod}.start_maintenance`, { method: 'POST' })
  },
}

function initials(value) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export const agentChatApi = {
  reply(mode, messages) {
    return request('/api/method/logicx_app.agent_chat.reply', {
      method: 'POST',
      body: JSON.stringify({ mode, messages }),
    })
  },
}

const lineMasterResource = '/api/resource/Line%20Master'
const lineMasterFields = ['name', 'factory', 'floor', 'area', 'line_no', 'modified']

export const lineMasterApi = {
  async list() {
    const records = []
    const fields = encodeURIComponent(JSON.stringify(lineMasterFields))
    for (let start = 0; ; start += 500) {
      const page = await request(`${lineMasterResource}?fields=${fields}&order_by=creation%20desc&limit_start=${start}&limit_page_length=500`)
      records.push(...page)
      if (page.length < 500) return records
    }
  },
  get(name) {
    return request(`${lineMasterResource}/${encodeURIComponent(name)}`)
  },
  save(name, values) {
    const data = Object.fromEntries(['factory', 'floor', 'area', 'line_no'].map(key => [key, String(values[key] ?? '').trim()]))
    return request(name ? `${lineMasterResource}/${encodeURIComponent(name)}` : lineMasterResource, {
      method: name ? 'PUT' : 'POST', body: JSON.stringify(data),
    })
  },
}
