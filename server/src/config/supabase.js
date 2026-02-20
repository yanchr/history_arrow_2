import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

let supabaseClient = null
let connectionVerified = false

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. Using mock data.')
} else {
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { error } = await supabaseClient.from('events').select('id').limit(1)
    if (error) throw error
    connectionVerified = true
    console.log('✅ Supabase connection verified.')
  } catch (err) {
    console.warn('⚠️  Could not connect to Supabase. Using mock data.', err.message || '')
    supabaseClient = null
  }
}

export const supabase = supabaseClient

export const isSupabaseConfigured = () => !!supabase
