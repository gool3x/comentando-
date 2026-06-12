// netlify/functions/comments.js
// Mesma lógica: ZERO credenciais no front-end.

const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  try {
    const supabase = getSupabase()

    // ── GET: lista comentários de um post ──
    if (event.httpMethod === 'GET') {
      const { slug } = event.queryStringParameters || {}
      if (!slug) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug é obrigatório' }) }
      }

      const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post não encontrado' }) }
      }

      const { data: comments } = await supabase
        .from('comments')
        .select('id, author_name, content, created_at')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ comments: comments ?? [] }),
      }
    }

    // ── POST: cria um comentário ──
    if (event.httpMethod === 'POST') {
      const { slug, author_name, content } = JSON.parse(event.body || '{}')

      if (!slug || !author_name?.trim() || !content?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug, author_name e content são obrigatórios' }) }
      }

      // Sanitização básica de tamanho
      const safeName    = author_name.trim().slice(0, 50)
      const safeContent = content.trim().slice(0, 500)

      const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post não encontrado' }) }
      }

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({ post_id: post.id, author_name: safeName, content: safeContent })
        .select('id, author_name, content, created_at')
        .single()

      if (error) throw error

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ comment }),
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) }

  } catch (err) {
    console.error('comments function error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) }
  }
}
