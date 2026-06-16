// A deliberately small, dependency-free Markdown renderer for the bits of
// admin-authored copy we display (position descriptions, campaign rules).
// It returns React elements — never dangerouslySetInnerHTML — so untrusted
// content can't inject markup, and link hrefs are restricted to http(s)/mailto.
//
// Supported: # / ## / ### headings, - or * bullet lists, 1. ordered lists,
// blank-line paragraphs, and inline **bold**, *italic*, `code`, [text](url).

function renderInline(text, keyBase) {
  const nodes = []
  // Order matters: bold (**) before italic (*).
  const pattern =
    /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}-${i}`}>{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      nodes.push(<em key={`${keyBase}-${i}`}>{m[2]}</em>)
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-${i}`}
          className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] text-maroon"
        >
          {m[3]}
        </code>,
      )
    } else if (m[4] !== undefined) {
      const safe = /^(https?:|mailto:)/i.test(m[5])
      nodes.push(
        safe ? (
          <a
            key={`${keyBase}-${i}`}
            href={m[5]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-maroon underline"
          >
            {m[4]}
          </a>
        ) : (
          m[4]
        ),
      )
    }
    last = pattern.lastIndex
    i += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function Markdown({ children, className = '' }) {
  const src = String(children ?? '').replace(/\r\n/g, '\n')
  const lines = src.split('\n')
  const blocks = []
  let list = null // { ordered, items: [] }
  let para = []

  const flushPara = () => {
    if (para.length) {
      const text = para.join(' ')
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-relaxed text-gray-600">
          {renderInline(text, `p-${blocks.length}`)}
        </p>,
      )
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag
          key={`l-${blocks.length}`}
          className={`ml-5 space-y-1 text-gray-600 ${
            list.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {list.items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `l-${blocks.length}-${idx}`)}</li>
          ))}
        </Tag>,
      )
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const ordered = /^\d+\.\s+(.*)$/.exec(line)

    if (heading) {
      flushPara()
      flushList()
      const level = heading[1].length
      const cls =
        level === 1
          ? 'font-display text-xl font-bold text-maroon'
          : level === 2
            ? 'font-display text-lg font-bold text-maroon'
            : 'font-semibold text-maroon'
      const Tag = `h${level + 2}` // map # -> h3 etc. so page h1/h2 stay unique
      blocks.push(
        <Tag key={`h-${blocks.length}`} className={cls}>
          {renderInline(heading[2], `h-${blocks.length}`)}
        </Tag>,
      )
    } else if (bullet || ordered) {
      flushPara()
      const isOrdered = Boolean(ordered)
      const item = (bullet ? bullet[1] : ordered[1])
      if (!list || list.ordered !== isOrdered) {
        flushList()
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push(item)
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()

  return <div className={`space-y-3 ${className}`}>{blocks}</div>
}
