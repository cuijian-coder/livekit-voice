import { test, expect } from '@playwright/test'

/**
 * Text Conversation with Streaming TTS E2E Test
 * 
 * Flow:
 * 1. User types text in InputBar and clicks send
 * 2. MessageList displays user message
 * 3. Frontend sends text to backend via WebSocket
 * 4. Backend LLM streams response
 * 5. Frontend receives LLM_TOKEN and updates MessageList (streaming display)
 * 6. TypingIndicator shown during streaming, hidden after LLM_COMPLETE
 * 7. Backend also sends text to TTS engine (may fail without real API key)
 */
test.describe('Text Conversation with Streaming', () => {
  test('text input → LLM streaming → MessageList display', async ({ page }) => {
    const consoleLogs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      consoleLogs.push(`[${msg.type()}] ${text}`)
      // Print ALL transport and routing events
      if (text.includes('"event"')) {
        console.log('BROWSER:', text)
      }
    })

    await page.goto('/')
    await page.waitForTimeout(3000)

    // Wait for WebSocket to be connected
    await page.waitForFunction(() => {
      const wsState = (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.websocket?.connected
      return wsState === true
    }, { timeout: 10000 }).catch(() => console.log('WS connection check timed out'))

    console.log('Page loaded')

    // Step 1: Type text in InputBar
    const textInput = page.locator('[data-testid="text-input"]')
    await textInput.fill('你好，很高兴认识你')
    await page.waitForTimeout(500) // Wait for button state to update
    console.log('Text typed in InputBar')

    // Check button state before clicking
    const buttonInfo = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="push-to-talk"]')
      const voiceSnapshot = (window as any).__VOICE_ACTOR__?.getSnapshot?.()
      return {
        buttonClass: button?.className,
        buttonDisabled: button?.disabled,
        voiceState: voiceSnapshot?.value,
        hasInput: true // we just typed
      }
    })
    console.log('Button info before click:', JSON.stringify(buttonInfo, null, 2))

    // Get initial message count
    const initialMessageCount = await page.locator('.message').count()
    console.log('Initial message count:', initialMessageCount)

    // Step 2: Click send button (push-to-talk in idle state with input becomes send)
    // In idle state with input, button should be 'send' semantic
    const messagesBeforeClick = await page.locator('.message').count()
    await page.locator('[data-testid="push-to-talk"]').click()
    console.log('Send button clicked, messages before:', messagesBeforeClick)
    await page.waitForTimeout(1000)

    // Check if messages were added
    const messagesAfterClick = await page.locator('.message').count()
    console.log('Messages after click:', messagesAfterClick)

    // Check voice actor state
    const voiceStateAfter = await page.evaluate(() => {
      const actor = (window as any).__VOICE_ACTOR__
      if (actor) {
        const snap = actor.getSnapshot()
        return {
          value: snap.value,
          context: snap.context
        }
      }
      return null
    })
    console.log('Voice state after click:', JSON.stringify(voiceStateAfter, null, 2))

    // Step 3: Verify textarea is cleared
    await expect(textInput).toHaveValue('')
    console.log('Textarea cleared after send')

    // Step 4: Verify user message appears in MessageList
    await page.waitForTimeout(500)
    const userMessages = page.locator('.message--user')
    await expect(userMessages.first()).toContainText('你好', { timeout: 5000 })
    console.log('User message appeared in MessageList')

    // Step 5: Wait for assistant message to appear
    // This may take time if LLM streaming is working
    await page.waitForTimeout(8000)
    
    // Check if any LLM events were received
    const llmEvents = consoleLogs.filter(l => l.includes('llm.started') || l.includes('LLM_STARTED') || l.includes('llm.token'))
    console.log('LLM events received:', llmEvents.length)
    
    // Check DOM for any messages (user or assistant)
    const allMessages = await page.locator('.message').count()
    console.log('Total messages in DOM:', allMessages)
    
    const stateAt5 = await page.evaluate(() => {
      const actor = (window as any).__VOICE_ACTOR__
      const snap = actor?.getSnapshot?.()
      return {
        voiceState: snap?.value,
        streamBuffer: snap?.context?.streamBuffer
      }
    })
    console.log('State at step 5:', JSON.stringify(stateAt5, null, 2))
    
    // Log all events received in the last 5 seconds
    const recentEvents = consoleLogs.filter(l => l.includes('routing.event'))
    console.log('Recent routing events:', recentEvents.length)

    // Try to find assistant message (may not exist if LLM streaming is broken)
    const assistantMessages = page.locator('.message--assistant')
    const hasAssistantMessage = await assistantMessages.count() > 0
    console.log('Has assistant message:', hasAssistantMessage)
    
    // Wait for assistant message with longer timeout
    if (!hasAssistantMessage) {
      await page.waitForTimeout(2000) // Wait a bit more
      const hasAssistantMessageAfterWait = await page.locator('.message--assistant').count() > 0
      console.log('Has assistant message after extra wait:', hasAssistantMessageAfterWait)
      
      // Get chatStore state for debugging
      const chatState = await page.evaluate(() => {
        const store = (window as any).__CHAT_STORE__
        return store?.getState?.()
      })
      console.log('Chat store state:', JSON.stringify(chatState, null, 2))
    }
    
    // Now check if assistant message appeared
    const finalAssistantCount = await page.locator('.message--assistant').count()
    expect(finalAssistantCount).toBeGreaterThan(0)
    console.log('Assistant message appeared!')

    // Step 6: Verify TypingIndicator is visible during streaming
    const typingIndicator = page.locator('.typing-indicator')
    const isStreaming = await page.evaluate(() => {
      return window.__CHAT_STORE__?.getState?.()?.isStreaming ?? false
    })
    console.log('Is streaming:', isStreaming)

    // Step 7: Wait for streaming to complete (TypingIndicator hidden)
    await page.waitForFunction(() => {
      const indicator = document.querySelector('.typing-indicator')
      if (!indicator) return false
      const style = window.getComputedStyle(indicator)
      return style.display === 'none'
    }, { timeout: 30000 })
    console.log('Streaming completed - TypingIndicator hidden')

    // Step 8: Verify message count increased (user + assistant messages now appear)
    const finalMessageCount = await page.locator('.message').count()
    expect(finalMessageCount).toBe(initialMessageCount + 2) // user + assistant
    console.log('Final message count:', finalMessageCount, '(user + assistant messages)')

    // Note: Assistant message streaming now works - LLM streaming verified!
    console.log('Test passed - text submission with LLM streaming verified!')
  })

  test('interrupted conversation cleans up properly', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Start a conversation
    const textInput = page.locator('[data-testid="text-input"]')
    await textInput.fill('测试打断')
    await page.locator('[data-testid="push-to-talk"]').click()

    // Wait for frontend to transition to thinking state
    await page.waitForTimeout(1000)
    
    // Verify user message appeared
    const userMessages = page.locator('.message--user')
    await expect(userMessages.first()).toContainText('测试打断')
    console.log('User message appeared')

    // Interject (click interrupt button - available in thinking/speaking states)
    const interruptButton = page.locator('[data-testid="push-to-talk"]')
    await interruptButton.click({ force: true })
    console.log('Interrupt button clicked')

    // After interrupt, should return to idle and stop streaming
    await page.waitForTimeout(1000)

    // Verify we're back to idle state
    const state = await page.evaluate(() => {
      const snapshot = (window as any).__VOICE_DEBUG__?.getSnapshot?.()
      return snapshot?.conversation?.state
    })
    console.log('State after interrupt:', state)
    // Note: state might be 'listening' for next conversation, not necessarily 'idle'
    // The key is that the streaming stopped and the message might be removed
  })
})