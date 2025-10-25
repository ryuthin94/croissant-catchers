document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('gameContainer');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const gameOverEl = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');

    let cssWidth = 0;
    let cssHeight = 0;

    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        cssWidth = Math.round(rect.width);
        cssHeight = Math.round(rect.height);
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // work in CSS pixels
        if (typeof paddle !== 'undefined' && paddle.updateSize) paddle.updateSize();
    }

    let score = 0;
    let timeLeft = 30;
    let running = true;
    let startTime = Date.now();

    scoreEl.textContent = score;
    timerEl.textContent = timeLeft;

    // multiple croissants
    const croissants = [];

    function createCroissant() {
        const size = 28 + Math.floor(Math.random() * 36);
        return {
            size,
            x: Math.random() * (Math.max(1, cssWidth - size)) + size / 2,
            y: -Math.random() * 160 - size,
            vy: (2 + Math.random() * 2),
            wobble: Math.random() * 2 - 1
        };
    }

    // Paddle / basket
    const paddle = {
        baseWidth: Math.min(160, Math.floor(cssWidth * 0.35)),
        width: Math.min(160, Math.floor(cssWidth * 0.35)),
        height: 22,
        x: Math.max(20, (cssWidth - Math.min(160, Math.floor(cssWidth * 0.35))) / 2),
        y: () => cssHeight - 44,
        color: '#c68642',
        updateSize() {
            this.baseWidth = Math.min(160, Math.floor(cssWidth * 0.35));
            // width will be adjusted by difficulty each frame
            this.x = Math.max(8, Math.min(this.x, cssWidth - this.width - 8));
        }
    };

    // Now that paddle exists, size the canvas and watch for resizes
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Input handlers: pointer (mouse/touch) and keyboard
    function setPaddleFromClientX(clientX) {
        const rect = container.getBoundingClientRect();
        const cx = clientX - rect.left;
        paddle.x = cx - paddle.width / 2;
        paddle.x = Math.max(8, Math.min(paddle.x, cssWidth - paddle.width - 8));
    }

    container.addEventListener('pointermove', (e) => {
        setPaddleFromClientX(e.clientX);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            setPaddleFromClientX(e.touches[0].clientX);
        }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
        const step = 20;
        if (e.key === 'ArrowLeft') {
            paddle.x = Math.max(8, paddle.x - step);
        } else if (e.key === 'ArrowRight') {
            paddle.x = Math.min(cssWidth - paddle.width - 8, paddle.x + step);
        }
    });

    // difficulty / spawning parameters
    let spawnInterval = 1200; // ms
    const minSpawnInterval = 300;
    let lastSpawn = 0;
    const maxCroissants = 8;

    function difficultyFactor() {
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        // slow linear difficulty growth
        return 1 + elapsed * 0.06; // +6% speed per second (tuned)
    }

    function update() {
        if (!running) return;

        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);

        // gradually reduce spawnInterval as time passes
        spawnInterval = Math.max(minSpawnInterval, 1200 - elapsed * 30);

        // ensure some croissants present
        if (now - lastSpawn > spawnInterval && croissants.length < Math.min(maxCroissants, 1 + Math.floor(elapsed / 6))) {
            croissants.push(createCroissant());
            lastSpawn = now;
        }

        const speedMul = difficultyFactor();

        // shrink paddle slightly with difficulty but clamp
        const shrink = Math.min(0.45, (speedMul - 1) * 0.12); // up to -45%
        paddle.width = Math.max(70, Math.round(paddle.baseWidth * (1 - shrink)));
        paddle.x = Math.max(8, Math.min(paddle.x, cssWidth - paddle.width - 8));

        // update croissants
        for (let i = croissants.length - 1; i >= 0; i--) {
            const c = croissants[i];
            // increase vy with difficulty and small randomness
            c.vy += 0.01 * speedMul; // slight acceleration over time per frame
            c.y += c.vy * speedMul;
            // subtle horizontal wobble
            c.x += Math.sin((c.y + c.wobble * 10) * 0.02) * 0.6;

            // collision: croissant (centered) vs paddle rectangle
            const croX = c.x;
            const croY = c.y;
            const half = c.size / 2;
            const paddleTop = paddle.y();
            const paddleLeft = paddle.x;
            const paddleRight = paddle.x + paddle.width;

            if ((croY + half) >= paddleTop && (croY - half) <= (paddleTop + paddle.height)) {
                if ((croX + half) >= paddleLeft && (croX - half) <= paddleRight) {
                    // caught
                    score += 1;
                    scoreEl.textContent = score;
                    // remove croissant
                    croissants.splice(i, 1);
                    continue;
                }
            }

            // missed: if it falls past bottom, remove without score
            if (c.y - c.size > cssHeight + 40) {
                croissants.splice(i, 1);
            }
        }
    }

    function drawRoundedRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function draw() {
        // clear
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        // background
        ctx.fillStyle = '#fff0e5';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // draw croissants
        for (const c of croissants) {
            ctx.font = `${c.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // slight shadow depending on speed
            ctx.fillStyle = '#5a3d2b';
            ctx.fillText('🥐', c.x, c.y);
        }

        // draw paddle / basket
        const px = paddle.x;
        const py = paddle.y();
        ctx.fillStyle = paddle.color;
        ctx.strokeStyle = '#8a5b3a';
        ctx.lineWidth = 2;
        drawRoundedRect(px, py, paddle.width, paddle.height, 8);

        // little handle line to look like basket edge
        ctx.strokeStyle = '#3e2a1e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 6);
        ctx.lineTo(px + paddle.width - 8, py + 6);
        ctx.stroke();
    }

    function loop() {
        if (!running) return;
        update();
        draw();
        requestAnimationFrame(loop);
    }

    // initial croissant(s)
    croissants.push(createCroissant());

    loop();

    const timerId = setInterval(() => {
        if (!running) return;
        timeLeft -= 1;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            running = false;
            clearInterval(timerId);
            gameOverEl.classList.remove('hidden');
            finalScoreEl.textContent = score;
        }
    }, 1000);

    // expose restart
    window.restartGame = function () {
        location.reload();
    };
});