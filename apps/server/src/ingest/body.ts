/**
 * Turns an uploaded or fetched body into export text: gunzips when it's
 * gzip (by header or by its magic bytes) and caps the inflated size, so a
 * small compressed body can't expand into gigabytes.
 */
import { promisify } from "node:util"
import { gunzip } from "node:zlib"

const inflate = promisify(gunzip)

/** A problem with the body itself; `status` is the HTTP answer. */
export class BodyError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "BodyError"
    this.status = status
  }
}

const isGzip = (buf: Buffer) => buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b

export const tooLarge = (maxBytes: number) =>
  new BodyError(413, `The export is larger than this server accepts (${Math.round(maxBytes / 1024 / 1024)} MB, INGEST_MAX_MB).`)

/** `contentEncoding` is the request's Content-Encoding header, if any. */
export async function bodyToText(body: Buffer, maxBytes: number, contentEncoding?: string): Promise<string> {
  const encoding = (contentEncoding ?? "identity").trim().toLowerCase()
  if (encoding !== "identity" && encoding !== "gzip" && encoding !== "x-gzip") {
    throw new BodyError(415, `Content-Encoding "${encoding}" isn't supported; send gzip or plain JSON.`)
  }
  let raw = body
  if (encoding !== "identity" || isGzip(body)) {
    try {
      raw = await inflate(body, { maxOutputLength: maxBytes })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") throw tooLarge(maxBytes)
      throw new BodyError(400, "The body isn't valid gzip.")
    }
  }
  if (raw.length > maxBytes) throw tooLarge(maxBytes)
  // Drop a UTF-8 byte-order mark, which JSON.parse would choke on.
  const text = raw.toString("utf8")
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
