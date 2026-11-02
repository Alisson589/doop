import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer } from '../server/mcp.ts'
import { initDb } from '../server/db/index.ts'

async function runMcpCanvasTest() {
  console.log('🚀 Inicializando banco de dados local (PGlite)...')
  await initDb()
  console.log('✅ Banco de dados PGlite pronto!')

  console.log('🚀 Iniciando teste integrado do MCP Canvas (Doop)...')

  const ownerName = 'Test User'
  const ownerId = 'test-user-123'

  const server = buildMcpServer(ownerName, ownerId)
  const client = new Client({ name: 'doop-test-client', version: '1.0.0' }, { capabilities: {} })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  console.log('✅ Cliente MCP conectado com sucesso!')

  try {
    // 1. Listar ferramentas
    const { tools } = await client.listTools()
    console.log(`📋 Total de ferramentas MCP registradas: ${tools.length}`)
    const toolNames = tools.map(t => t.name)
    console.log(`🛠️ Ferramentas disponíveis: ${toolNames.slice(0, 10).join(', ')}... (+${toolNames.length - 10} outras)`)

    // 2. Chamar get_guide
    console.log('\n📖 [1/5] Testando get_guide...')
    const guideResult = await client.callTool({
      name: 'get_guide',
      arguments: { topic: 'doop-instructions' }
    })
    console.log('✅ get_guide executado com sucesso!')

    // 3. Criar Canvas
    console.log('\n🎨 [2/5] Testando create_canvas...')
    const createCanvasResult = await client.callTool({
      name: 'create_canvas',
      arguments: { name: 'Canvas de Teste MCP', agent_name: 'Antigravity' }
    })
    const canvasData = JSON.parse((createCanvasResult.content as any)[0].text)
    const canvasId = canvasData.id
    console.log(`✅ Canvas criado com ID: ${canvasId} (Nome: "${canvasData.name}", URL: "${canvasData.url}")`)

    // 4. Criar Frame no Canvas
    console.log('\n🖼️ [3/5] Testando create_frame no Canvas...')
    const initialHtml = `
      <div class="w-full h-full bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
        <h1 class="text-4xl font-bold mb-4">Bem-vindo ao Doop Canvas</h1>
        <p class="text-slate-400 text-lg">Criado via MCP Tool por Antigravity</p>
      </div>
    `.trim()

    const createFrameResult = await client.callTool({
      name: 'create_frame',
      arguments: {
        canvas_id: canvasId,
        name: 'Hero Section',
        html: initialHtml,
        agent_name: 'Antigravity',
        width: 1200,
        height: 600,
        x: 100,
        y: 100
      }
    })
    const frameResultData = JSON.parse((createFrameResult.content as any)[0].text)
    const frameId = frameResultData.frame.id
    console.log(`✅ Frame criado com ID: ${frameId} (Nome: "${frameResultData.frame.name}")`)

    // 5. Inserir mais conteúdo com append_frame_html
    console.log('\n📝 [4/5] Testando append_frame_html (streaming de seção)...')
    const additionalChunk = `
      <div class="mt-4 p-4 bg-indigo-600 rounded-lg text-center font-semibold">
        Seção de Recursos Adicionais Renderizada ao Vivo
      </div>
    `.trim()
    
    await client.callTool({
      name: 'append_frame_html',
      arguments: {
        frame_id: frameId,
        html_chunk: additionalChunk,
        start: false,
        done: true,
        agent_name: 'Antigravity'
      }
    })
    console.log('✅ append_frame_html executado com sucesso!')

    // 6. Editar HTML do Frame (edit_frame_html)
    console.log('\n✏️ [5/5] Testando edit_frame_html (substituição pontual)...')
    await client.callTool({
      name: 'edit_frame_html',
      arguments: {
        frame_id: frameId,
        old_str: 'Criado via MCP Tool por Antigravity',
        new_str: 'Testado e validado com sucesso via MCP!',
        agent_name: 'Antigravity'
      }
    })
    
    // Verificar estado final lendo o frame
    const getFrameResult = await client.callTool({
      name: 'get_frame',
      arguments: { frame_id: frameId }
    })
    const updatedFrame = JSON.parse((getFrameResult.content as any)[0].text)
    if (updatedFrame.html.includes('Testado e validado com sucesso via MCP!')) {
      console.log('✅ Edição de frame validada com sucesso! Conteúdo atualizado verificado.')
    } else {
      throw new Error('A alteração de HTML não foi encontrada no frame!')
    }

    // 7. Obter estado do Canvas completo
    console.log('\n📊 Validando get_canvas...')
    const getCanvasResult = await client.callTool({
      name: 'get_canvas',
      arguments: { canvas_id: canvasId, agent_name: 'Antigravity' }
    })
    const finalCanvas = JSON.parse((getCanvasResult.content as any)[0].text)
    console.log(`✅ Canvas "${finalCanvas.name}" validado com ${finalCanvas.frames.length} frame(s).`)

    console.log('\n🎉 TODOS OS TESTES DO MCP CANVAS PASSARAM COM SUCESSO INTEGRALMENTE!')
  } finally {
    await client.close()
    await server.close()
  }
}

runMcpCanvasTest().catch((err) => {
  console.error('❌ Erro no teste MCP:', err)
  process.exit(1)
})
