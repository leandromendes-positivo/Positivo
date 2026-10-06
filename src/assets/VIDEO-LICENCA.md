# Vídeo da tela de entrada

- **Obra:** A circuit board with blue lines on it.
- **Autor:** Oleg Gamulinskii.
- **Banco e página original:** [Pexels, vídeo 6466100](https://www.pexels.com/video/a-circuit-board-with-blue-lines-on-it-6466100/).
- **Licença:** [Pexels License](https://www.pexels.com/license/), que permite uso pessoal/comercial e adaptação. O vídeo é parte da interface, não um produto de stock para revenda. A licença da mídia não é substituída pela do código.
- **Cópia consultada:** [circuit-flow.webm](https://github.com/Sadat321/hashemi-portfolio/blob/1b5c31b4b35cd2ebad4df22f3790c0744f858ffe/public/assets/circuit-flow.webm), com origem, autor e licença identificados na seção *Ambient media credits* do [README dessa revisão](https://github.com/Sadat321/hashemi-portfolio/blob/1b5c31b4b35cd2ebad4df22f3790c0744f858ffe/README.md#ambient-media-credits). A cópia pública foi usada porque o acesso direto ao catálogo Pexels estava bloqueado na rede do ambiente.
- **SHA-256 da cópia WebM:** `6935c6139ec26328f6bcc700614e9c6657052f65c1044f09e2716c2f53bb3293`.
- **Arquivos:** `login-circuitos.webm` (10 s, 1280 × 720, sem áudio), `login-circuitos.mp4` (conversão H.264) e `login-circuitos.jpg` (quadro de abertura).

O build incorpora a mídia ao HTML. O login não faz requisições ao Pexels ou ao repositório de origem. `autoplay`, `muted`, `loop` e `playsinline` mantêm a reprodução contínua; não há controles de pausa. Políticas de reprodução do navegador ainda se aplicam.

A versão MP4 e o quadro de abertura foram preparados com:

```sh
ffmpeg -i login-circuitos.webm -an -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart login-circuitos.mp4
ffmpeg -ss 2 -i login-circuitos.webm -frames:v 1 -q:v 4 login-circuitos.jpg
```
