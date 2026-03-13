// OCR 识别 API
export const ocrApi = {
  // 使用大模型 API 进行 OCR 识别
  async recognizeImage(imageFile: File): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      const apiKey = import.meta.env.VITE_LLM_API_KEY
      const apiUrl = 'https://llm.xiaochisaas.com'

      if (!apiKey) {
        throw new Error('LLM API Key 未配置，请在 .env 中设置 VITE_LLM_API_KEY')
      }

      // 压缩图片
      const base64Image = await compressImageForLLM(imageFile)

      // 调用大模型 API
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `你是一名高精度中文手写文本识别助手。请识别图片中的全部手写文字，并忠实转写原文。

要求：
- 只做OCR转写，不做总结、翻译、润色、纠错。
- 保留原始段落、换行、序号、分点、标点。
- 保留原文中的错别字和不规范表达。
- 不确定的字词用【疑似：xxx】标记。
- 完全无法辨认的部分用【无法辨认】标记。
- 不要凭空补写。
- 如果图片中既有印刷体也有手写体，优先识别手写体正文。
- 输出必须是纯文本本身，不要附加解释。

请直接输出识别结果。`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 调用失败: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      const recognizedText = result.choices?.[0]?.message?.content?.trim()

      if (!recognizedText) {
        throw new Error('未识别到文字内容')
      }

      return {
        success: true,
        text: recognizedText,
      }
    } catch (error: any) {
      console.error('OCR 识别失败:', error)
      return {
        success: false,
        error: error.message || 'OCR 识别失败',
      }
    }
  },
}

// 压缩图片用于 LLM API
async function compressImageForLLM(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxBase64Size = 3 * 1024 * 1024
        let scale = 1

        const estimatedSize = (file.size * 4) / 3
        if (estimatedSize > maxBase64Size) {
          scale = Math.sqrt(maxBase64Size / estimatedSize) * 0.8
        }

        const canvas = document.createElement('canvas')
        const newWidth = Math.max(800, Math.floor(img.width * scale))
        const newHeight = Math.floor((img.height * newWidth) / img.width)

        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        const tryCompress = (quality: number): string | null => {
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          const base64 = dataUrl.split(',')[1]
          if (base64 && base64.length < maxBase64Size) {
            return base64
          }
          return null
        }

        let base64 = tryCompress(0.8)
        if (!base64) base64 = tryCompress(0.6)
        if (!base64) base64 = tryCompress(0.4)

        if (!base64) {
          const smallerWidth = Math.floor(newWidth * 0.7)
          const smallerHeight = Math.floor(newHeight * 0.7)
          canvas.width = smallerWidth
          canvas.height = smallerHeight
          ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5)
          base64 = dataUrl.split(',')[1] || ''
        }

        resolve(base64 || '')
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
