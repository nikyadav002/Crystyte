import { detectAndParse } from '../parsers/detect.js'
import { normalizeStructure } from '../lib/structure.js'

self.onmessage = ({ data: { text, filename } }) => {
  try {
    const raw = detectAndParse(text, filename)
    const structure = normalizeStructure(raw)
    self.postMessage({ structure })
  } catch (err) {
    self.postMessage({ error: String(err.message ?? err) })
  }
}
