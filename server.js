const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({
    // ESSENCIAL: Expõe nosso header customizado para o navegador
    exposedHeaders: ['X-Video-Title'],
}));
app.use(express.json());

const downloadsFolder = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsFolder)) fs.mkdirSync(downloadsFolder);

const activeDownloads = new Set();

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL não fornecida" });

    if (activeDownloads.has(url)) {
        return res.status(429).json({ error: "Um download para esta URL já está em andamento." });
    }

    try {
        activeDownloads.add(url);

        // --- MELHORIA 1: Extrair o Título do Vídeo ---
        console.log(`[🔎] Extraindo metadados do vídeo...`);
        const videoInfo = await youtubedl(url, { dumpSingleJson: true });
        // Limpa o título para ser um nome de arquivo válido no Windows/Mac/Linux
        const sanitizedTitle = videoInfo.title.replace(/[\/:*?"<>|]/g, '_').substring(0, 100);
        console.log(`[🏷️] Título encontrado: ${sanitizedTitle}`);
        
        const filePath = path.join(downloadsFolder, `video_${Date.now()}.mp4`);

        console.log(`[🚀] Iniciando extração PRO para: ${url}`);
        await youtubedl(url, {
            output: filePath,
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            mergeOutputFormat: 'mp4'
        });

        console.log(`[✅] Vídeo processado! Enviando para a extensão...`);

        // --- MELHORIA 2: Enviar o Título no Header da Resposta ---
        res.setHeader('X-Video-Title', sanitizedTitle);
        
        res.download(filePath, (err) => {
            if (err) console.error("Erro ao enviar:", err);
            fs.unlinkSync(filePath); 
        });

    } catch (error) {
        console.error("[❌] Falha na extração do yt-dlp.", error);
        let userMessage = "Falha ao extrair vídeo. Pode ser privado ou ter restrição geográfica.";
        res.status(500).json({ error: userMessage });
    
    } finally {
        activeDownloads.delete(url);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor INTELIGENTE rodando na porta ${PORT}`);
    console.log(`Esperando ordens da extensão...`);
});