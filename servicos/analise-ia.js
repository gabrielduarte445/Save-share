
export async function analisarImagemProduto(imagemUrlBase64, apiKeyGemini) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`;

    const prompt = `Analise esta foto de fruta/vegetal para um app de combate ao desperdício. 
Responda exclusivamente em formato JSON estrito, sem formatação markdown ou texto adicional, usando as chaves:
- "diagnostico": ("provável bom estado" ou "sinais de deterioração")
- "motivo": (uma frase curta explicando se há mofo, podridão visível ou apenas marcas estéticas normais)`;

    try {
        const base64Limpo = imagemUrlBase64.replace(/^data:image\/\w+;base64,/, "");

        const resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Limpo
                            }
                        }
                    ]
                }]
            })
        });

        if (!resposta.ok) {
            throw new Error(`Erro na API Gemini: ${resposta.status} ${resposta.statusText}`);
        }

        const dados = await resposta.json();

        if (!dados.candidates || !dados.candidates[0]?.content?.parts[0]?.text) {
            throw new Error("Resposta da API em formato inesperado.");
        }

        let textoResultado = dados.candidates[0].content.parts[0].text.trim();
        textoResultado = textoResultado.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

        return JSON.parse(textoResultado);

    } catch (erro) {
        console.error("Erro na análise da IA:", erro);
        return { 
            diagnostico: "indeterminado", 
            motivo: "Não foi possível analisar a imagem automaticamente." 
        };
    }
}