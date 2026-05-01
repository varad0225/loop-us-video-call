// gameEngine.js

const GameManager = {
    arena: document.getElementById('game-arena'),
    modal: document.getElementById('game-play-modal'),
    gameId: null,
    isLeaver: false,
    
    // Connect Four state
    c4Board: [],
    c4Turn: 1, // 1 for leaver, 2 for partner
    
    // Secret Number state
    mySecret: null,
    partnerSecret: null,
    
    start(gameId, isLeaverRole) {
        this.gameId = gameId;
        this.isLeaver = isLeaverRole;
        this.arena.innerHTML = '';
        this.modal.classList.remove('hidden');
        
        const header = document.createElement('div');
        header.className = 'game-header';
        const title = document.createElement('h2');
        title.className = 'game-title';
        const status = document.createElement('div');
        status.className = 'game-status';
        status.id = 'game-status-text';
        
        header.appendChild(title);
        header.appendChild(status);
        this.arena.appendChild(header);

        switch(gameId) {
            case 'connect-four':
                title.textContent = 'Connect Four';
                this.initConnectFour();
                break;
            case 'secret-number':
                title.textContent = 'Secret Number Match';
                this.initSecretNumber();
                break;
            case 'catch-heart':
                title.textContent = 'Catch the Heart';
                this.initCatchHeart();
                break;
            case 'memory-match':
                title.textContent = 'Memory Match';
                this.initMemoryMatch();
                break;
            case 'quick-tap':
                title.textContent = 'Quick Tap Challenge';
                this.initQuickTap();
                break;
        }
    },
    
    setStatus(text) {
        const el = document.getElementById('game-status-text');
        if(el) el.textContent = text;
    },

    finishGame(isWin) {
        this.setStatus(isWin ? 'Challenge Completed!' : 'Challenge Failed!');
        setTimeout(() => {
            this.modal.classList.add('hidden');
            if (this.isLeaver) {
                // Determine if we should emit result or just handle it locally
                // Both clients get the result via socket eventually
                socket.emit('game_result', { roomId: currentRoomId, isWin });
            }
        }, 2000);
    },
    
    handleAction(action) {
        if (this.gameId === 'connect-four') {
            this.c4DropPiece(action.col, action.player);
        } else if (this.gameId === 'secret-number') {
            this.partnerSecret = action.number;
            this.checkSecretNumber();
        }
    },

    // --- GAME 1: CONNECT FOUR ---
    initConnectFour() {
        this.c4Board = Array(6).fill(null).map(() => Array(7).fill(0));
        this.c4Turn = 1;
        this.setStatus(this.isLeaver ? 'Your Turn (Pink)' : 'Waiting for partner (Pink)');
        
        const board = document.createElement('div');
        board.className = 'c4-board';
        
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                const cell = document.createElement('div');
                cell.className = 'c4-cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.onclick = () => {
                    const myPlayer = this.isLeaver ? 1 : 2;
                    if (this.c4Turn === myPlayer) {
                        if (this.c4DropPiece(c, myPlayer)) {
                            socket.emit('game_action', { roomId: currentRoomId, action: { col: c, player: myPlayer } });
                        }
                    }
                };
                board.appendChild(cell);
            }
        }
        this.arena.appendChild(board);
    },
    
    c4DropPiece(col, player) {
        for (let r = 5; r >= 0; r--) {
            if (this.c4Board[r][col] === 0) {
                this.c4Board[r][col] = player;
                const cell = this.arena.querySelector(`.c4-cell[data-r='${r}'][data-c='${col}']`);
                cell.classList.add(player === 1 ? 'player1' : 'player2');
                
                if (this.c4CheckWin(player)) {
                    this.setStatus(`Player ${player === 1 ? 'Pink' : 'Blue'} wins!`);
                    if (this.isLeaver) this.finishGame(player === 1);
                } else {
                    this.c4Turn = player === 1 ? 2 : 1;
                    const myPlayer = this.isLeaver ? 1 : 2;
                    this.setStatus(this.c4Turn === myPlayer ? 'Your Turn' : 'Partner\'s Turn');
                }
                return true;
            }
        }
        return false;
    },
    
    c4CheckWin(p) {
        const b = this.c4Board;
        // Check horizontal, vertical, diagonal
        for(let r=0; r<6; r++) {
            for(let c=0; c<7; c++) {
                if (c<4 && b[r][c]==p && b[r][c+1]==p && b[r][c+2]==p && b[r][c+3]==p) return true;
                if (r<3 && b[r][c]==p && b[r+1][c]==p && b[r+2][c]==p && b[r+3][c]==p) return true;
                if (c<4 && r<3 && b[r][c]==p && b[r+1][c+1]==p && b[r+2][c+2]==p && b[r+3][c+3]==p) return true;
                if (c>2 && r<3 && b[r][c]==p && b[r+1][c-1]==p && b[r+2][c-2]==p && b[r+3][c-3]==p) return true;
            }
        }
        return false;
    },

    // --- GAME 2: SECRET NUMBER MATCH ---
    initSecretNumber() {
        this.mySecret = null;
        this.partnerSecret = null;
        
        const container = document.createElement('div');
        container.className = 'secret-number-container';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'secret-number-input';
        input.placeholder = '1-100';
        input.min = 1; input.max = 100;
        
        const btn = document.createElement('button');
        btn.className = 'btn primary glowing';
        btn.textContent = 'Submit Secret';
        btn.onclick = () => {
            if (!input.value) return;
            this.mySecret = input.value;
            btn.disabled = true;
            input.disabled = true;
            this.setStatus('Waiting for partner...');
            socket.emit('game_action', { roomId: currentRoomId, action: { number: this.mySecret } });
            this.checkSecretNumber();
        };
        
        container.appendChild(input);
        container.appendChild(btn);
        this.arena.appendChild(container);
        this.setStatus('Pick a number from 1 to 100');
    },
    
    checkSecretNumber() {
        if (this.mySecret !== null && this.partnerSecret !== null) {
            const match = this.mySecret === this.partnerSecret;
            this.setStatus(match ? `Both chose ${this.mySecret}! It's a match! ❤️` : `Mismatch! You: ${this.mySecret}, Partner: ${this.partnerSecret} 😝`);
            if (this.isLeaver) this.finishGame(match);
        }
    },

    // --- GAME 3: CATCH THE HEART ---
    initCatchHeart() {
        if (!this.isLeaver) {
            this.setStatus('Your partner is playing Catch the Heart...');
            return;
        }
        
        const container = document.createElement('div');
        container.className = 'catch-heart-arena';
        this.arena.appendChild(container);
        
        let score = 0;
        let timeLeft = 10;
        this.setStatus(`Catch 5 hearts! Time left: ${timeLeft}s`);
        
        const spawnHeart = () => {
            const h = document.createElement('i');
            h.className = 'fa-solid fa-heart catch-target';
            h.style.color = '#f472b6';
            h.style.left = Math.random() * 80 + '%';
            h.style.top = Math.random() * 80 + '%';
            h.onclick = () => {
                score++;
                h.remove();
                if (score >= 5) {
                    clearInterval(timer);
                    this.finishGame(true);
                } else {
                    spawnHeart();
                }
            };
            container.innerHTML = '';
            container.appendChild(h);
        };
        spawnHeart();
        
        const timer = setInterval(() => {
            timeLeft--;
            this.setStatus(`Catch 5 hearts! Time left: ${timeLeft}s | Score: ${score}`);
            if (timeLeft <= 0) {
                clearInterval(timer);
                if (score < 5) this.finishGame(false);
            }
        }, 1000);
    },

    // --- GAME 4: MEMORY MATCH ---
    initMemoryMatch() {
        if (!this.isLeaver) {
            this.setStatus('Your partner is playing Memory Match...');
            return;
        }
        
        const grid = document.createElement('div');
        grid.className = 'memory-grid';
        
        const emojis = ['💖', '💖', '🥰', '🥰', '🔥', '🔥', '✨', '✨', '🥺', '🥺', '💍', '💍', '💌', '💌', '🌹', '🌹'];
        emojis.sort(() => 0.5 - Math.random());
        
        let flipped = [];
        let matched = 0;
        
        emojis.forEach((emoji, i) => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.val = emoji;
            card.onclick = () => {
                if (flipped.length < 2 && !card.classList.contains('flipped')) {
                    card.classList.add('flipped');
                    card.textContent = emoji;
                    flipped.push(card);
                    
                    if (flipped.length === 2) {
                        if (flipped[0].dataset.val === flipped[1].dataset.val) {
                            matched++;
                            flipped = [];
                            if (matched === 8) this.finishGame(true);
                        } else {
                            setTimeout(() => {
                                flipped[0].classList.remove('flipped');
                                flipped[0].textContent = '';
                                flipped[1].classList.remove('flipped');
                                flipped[1].textContent = '';
                                flipped = [];
                            }, 1000);
                        }
                    }
                }
            };
            grid.appendChild(card);
        });
        
        this.arena.appendChild(grid);
        this.setStatus('Match all pairs to win!');
        
        let timeLeft = 30;
        const timer = setInterval(() => {
            timeLeft--;
            this.setStatus(`Match all pairs! Time left: ${timeLeft}s`);
            if (timeLeft <= 0) {
                clearInterval(timer);
                if (matched < 8) this.finishGame(false);
            }
            if (matched === 8) clearInterval(timer);
        }, 1000);
    },

    // --- GAME 5: QUICK TAP ---
    initQuickTap() {
        if (!this.isLeaver) {
            this.setStatus('Your partner is playing Quick Tap Challenge...');
            return;
        }
        
        const container = document.createElement('div');
        container.className = 'catch-heart-arena'; // Reuse container style
        this.arena.appendChild(container);
        
        const btn = document.createElement('button');
        btn.className = 'quick-tap-btn';
        btn.textContent = 'TAP';
        
        let score = 0;
        let timeLeft = 10;
        
        const moveBtn = () => {
            btn.style.left = Math.random() * 80 + '%';
            btn.style.top = Math.random() * 80 + '%';
        };
        
        btn.onclick = () => {
            score++;
            moveBtn();
            if (score >= 15) {
                clearInterval(timer);
                this.finishGame(true);
            }
        };
        
        container.appendChild(btn);
        moveBtn();
        
        const timer = setInterval(() => {
            timeLeft--;
            this.setStatus(`Tap 15 times! Time left: ${timeLeft}s | Score: ${score}`);
            if (timeLeft <= 0) {
                clearInterval(timer);
                if (score < 15) this.finishGame(false);
            }
        }, 1000);
    }
};
