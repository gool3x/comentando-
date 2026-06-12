// netlify/functions/likes.js
// Credenciais ficam APENAS em variáveis de ambiente no painel da Netlify.
// O front-end NUNCA vê SUPABASE_URL nem SUPABASE_ANON_KEY.

const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  const url  = process.env.SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_KEY  // use a service-role key no backend
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  try {
    const supabase = getSupabase()

    // ── GET: retorna contagem + se visitante já curtiu ──
    if (event.httpMethod === 'GET') {
      const { slug, visitor } = event.queryStringParameters || {}
      if (!slug || !visitor) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug e visitor são obrigatórios' }) }
      }

      // Busca o post
      const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post não encontrado' }) }
      }

      const [{ count }, { data: userLike }] = await Promise.all([
        supabase.from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id),
        supabase.from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('visitor_id', visitor)
          .maybeSingle(),
      ])

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count: count ?? 0, userLiked: !!userLike }),
      }
    }

    // ── POST: like / unlike ──
    if (event.httpMethod === 'POST') {
      const { slug, visitor, action } = JSON.parse(event.body || '{}')
      if (!slug || !visitor || !action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug, visitor e action são obrigatórios' }) }
      }

      const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post não encontrado' }) }
      }

      if (action === 'like') {
        await supabase
          .from('likes')
          .upsert({ post_id: post.id, visitor_id: visitor }, { onConflict: 'post_id,visitor_id' })
      } else {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('visitor_id', visitor)
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) }

  } catch (err) {
    console.error('likes function error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) }
  }
}
