// src/hooks/useChat.js
import React from 'react';
import kb from '../knowledge/knowledgeBase';
import { chatStream } from '../services/api';

export default function useChat() {
  const [messages, setMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const sendMessage = async (userText) => {
    setError('');
    setLoading(true);

    // Add user message immediately
    const userMessage = { role: 'user', content: userText, ts: Date.now() };
    setMessages(prev => [...prev, userMessage]);

    try {
      // FIRST: Always try to get answer directly from knowledge base
      const kbAnswer = kb.generateAnswer(userText);
      
      if (kbAnswer) {
        // Direct KB answer found - use it immediately
        const assistantMessage = { 
          role: 'assistant', 
          content: kbAnswer.answer,
          ts: Date.now(),
          source: kbAnswer.source,
          confidence: kbAnswer.confidence
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setLoading(false);
        return;
      }

      // SECOND: If no direct KB answer, use AI with KB context
      let systemPrompt = `You are a helpful assistant for Swiss German University (SGU). 
You MUST use the provided SGU knowledge base context to answer questions.
If the information is not in the context, say "I don't have that specific information in my SGU knowledge base."
Never make up information about SGU programs, courses, or details.`;

      // Build context from available KB data
      let context = 'SGU KNOWLEDGE BASE CONTEXT:\n\n';
      
      // Add all programs list to context
      const allPrograms = kb.getAllPrograms();
      context += `AVAILABLE PROGRAMS: ${allPrograms.join(', ')}\n\n`;
      
      // Add relevant programs based on query
      const relevantPrograms = kb.searchPrograms(userText);
      if (relevantPrograms.length > 0) {
        context += `RELEVANT PROGRAMS:\n`;
        relevantPrograms.slice(0, 3).forEach(program => {
          const programData = kb.getProgramDetails(program.name);
          const desc = programData?.description ? programData.description.substring(0, 100) + '...' : 'No description available';
          context += `- ${program.name} (${program.faculty || 'No faculty'}): ${desc}\n`;
        });
        context += '\n';
      }
      
      // Add FAQ matches
      const faqMatches = kb.faqs.filter(faq => 
        userText.toLowerCase().includes(faq.q.toLowerCase()) ||
        faq.q.toLowerCase().includes(userText.toLowerCase())
      );
      
      if (faqMatches.length > 0) {
        context += `RELATED FAQS:\n`;
        faqMatches.slice(0, 2).forEach(faq => {
          context += `- Q: ${faq.q}\n  A: ${faq.a}\n`;
        });
        context += '\n';
      }

      context += `QUESTION: ${userText}`;

      // Prepare messages for API
      const apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt}\n\n${context}`
        },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userText }
      ];

      // Call API
      const assistantMessage = { 
        role: 'assistant', 
        content: '', 
        ts: Date.now(), 
        streaming: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      const stream = await chatStream({
        model: 'gpt-oss:120b-cloud',
        messages: apiMessages,
        temperature: 0.1 // Lower temperature for more factual responses
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullContent += data.message.content;
              
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMsg,
                    content: fullContent
                  };
                }
                return newMessages;
              });
            }
            
            if (data.done) {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMsg,
                    streaming: false
                  };
                }
                return newMessages;
              });
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }

    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to send message');
      
      // Add error message
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.', 
          ts: Date.now(),
          error: true 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat
  };
}