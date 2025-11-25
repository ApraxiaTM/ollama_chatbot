// src/services/api.js
const API_BASE = 'http://localhost:8787';

export async function chatStream({ model, messages, temperature = 0.3 }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-oss:120b-cloud',
      messages,
      temperature: Math.max(0.1, Math.min(temperature, 0.7)),
      stream: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return response.body;
}

export async function listModels() {
  try {
    const response = await fetch(`${API_BASE}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}