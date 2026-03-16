const express = require('express');
const cors = require('cors'); // <-- A NOVA LINHA MÁGICA
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const activeDownloads = new Set();

app.use(cors()); // <-- DIZEMOS AO SERVIDOR PARA ACEITAR LIGAÇÕES DE FORA
app.use(express.json());

app.post('/api/download', (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL do vídeo é obrigatória.' });
    }
    if (activeDownloads.has(videoUrl)) {
        return res.status(429).json({ error: 'Este download já está em andamento.' });
    }

    console.log(`[${new Date().toLocaleTimeString()}] Pedido recebido para: ${videoUrl}`);
    activeDownloads.add(videoUrl);

    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir);
    }
    const tempFileName = `video_${Date.now()}`;
    const outputPath = path.join(downloadsDir, `${tempFileName}.mp4`);

    const command = `yt-dlp -o "${outputPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        activeDownloads.delete(videoUrl);

        if (error || !fs.existsSync(outputPath)) {
            console.error(`Falha no yt-dlp: ${stderr}`);
            return res.status(500).json({ error: 'Falha ao extrair vídeo. Pode ser privado ou ter restrição geográfica.' });
        }
        
        const titleMatch = stderr.match(/$$download$$ Destination: (.*?)\.mp4/);
        let finalFileName = "video_baixado";
        if(titleMatch && titleMatch[1]) {
           finalFileName = titleMatch[1].replace(path.join(downloadsDir, ''), '').replace(/\\/g, '');
        }

        console.log(`[${new Date().toLocaleTimeString()}] Download concluído. Enviando para o cliente.`);
        res.setHeader('X-Video-Title', encodeURIComponent(finalFileName));
        res.download(outputPath, (err) => {
            if (err) {
                console.error("Erro ao enviar o arquivo:", err);
            }
            fs.unlink(outputPath, (unlinkErr) => {
                if (unlinkErr) console.error("Erro ao deletar arquivo temporário:", unlinkErr);
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🔥 Servidor INTELIGENTE rodando na porta ${PORT}`);
    console.log('Esperando ordens da extensão...');
});
