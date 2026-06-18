import type { VisionProfile } from './visionTypes'

const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export interface PostMeta {
  id: string
  topic: string
  /** 投稿者の色覚プロファイル (4軸) */
  artist_profile: VisionProfile
  comment: string | null
  image_url: string
  width: number
  height: number
  created_at: number
}

export interface ListResponse {
  posts: PostMeta[]
  cursor: string | null
}

export async function createPost(args: {
  image: Blob
  topic: string
  artist_profile: VisionProfile
  comment?: string
  width: number
  height: number
}): Promise<PostMeta> {
  const fd = new FormData()
  fd.append('image', args.image, 'drawing.png')
  fd.append(
    'meta',
    JSON.stringify({
      topic: args.topic,
      artist_profile: args.artist_profile,
      comment: args.comment ?? null,
      width: args.width,
      height: args.height,
    }),
  )
  const res = await fetch(`${API_BASE}/api/posts`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`投稿失敗: ${res.status}`)
  return (await res.json()) as PostMeta
}

export async function listPosts(opts: {
  topic?: string
  cursor?: string
}): Promise<ListResponse> {
  const params = new URLSearchParams()
  if (opts.topic) params.set('topic', opts.topic)
  if (opts.cursor) params.set('cursor', opts.cursor)
  const res = await fetch(`${API_BASE}/api/posts?${params.toString()}`)
  if (!res.ok) throw new Error(`取得失敗: ${res.status}`)
  return (await res.json()) as ListResponse
}

export async function getPost(id: string): Promise<PostMeta> {
  const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`取得失敗: ${res.status}`)
  return (await res.json()) as PostMeta
}
