import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

let authClient = null
if (supabaseUrl && supabaseAnonKey) {
  authClient = createClient(supabaseUrl, supabaseAnonKey)
}

export async function requireAuth(req, res, next) {
  if (!authClient) {
    return next()
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = header.slice(7)

  const { data: { user }, error } = await authClient.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = user
  next()
}
