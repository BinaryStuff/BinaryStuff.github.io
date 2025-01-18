const gameArea = document.getElementById('gameArea');
const ctx = gameArea.getContext('2d');
const gameSize = 600;  // Adjusted to the new canvas size
const gridSize = 20;
const gameSpeed = 100;
let snake = [{x: 160, y: 160}, {x: 140, y: 160}, {x: 120, y: 160}, {x: 100, y: 160}];
let dx = gridSize;
let dy = 0;
let foodX;
let foodY;
let changingDirection = false;
let gameRunning = false;

// Start screen and game over screen elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');

// Touch event variables
let touchStartX = 0;
let touchStartY = 0;

function clearCanvas() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, gameSize, gameSize);
}

function drawSnakePart(snakePart) {
    ctx.fillStyle = 'lightgreen';
    ctx.fillRect(snakePart.x, snakePart.y, gridSize, gridSize);
}

function drawSnake() {
    snake.forEach(drawSnakePart);
}

function advanceSnake() {
    const head = {x: snake[0].x + dx, y: snake[0].y + dy};
    snake.unshift(head); // Add new head to the snake

    // Check if the snake has eaten the food
    if (snake[0].x === foodX && snake[0].y === foodY) {
        createFood(); // Create new food because the snake just ate the last one
        // Do not remove the last part of the snake because it needs to grow
    } else {
        snake.pop(); // Remove the last part of the snake if it hasn't eaten
    }
}

function randomFood(min, max) {
    return Math.round((Math.random() * (max-min) + min) / gridSize) * gridSize;
}

function createFood() {
    foodX = randomFood(0, gameSize - gridSize);
    foodY = randomFood(0, gameSize - gridSize);
    snake.forEach(part => {
        const foodIsOnSnake = part.x == foodX && part.y == foodY;
        if (foodIsOnSnake) createFood(); // Recreate the food if it's on the snake
    });
}

function drawFood() {
    ctx.fillStyle = 'red';
    ctx.fillRect(foodX, foodY, gridSize, gridSize);
}

function changeDirection(event) {
    const keyPressed = event.keyCode || event.type;
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    if (changingDirection) return;
    changingDirection = true;

    const goingUp = dy === -gridSize;
    const goingDown = dy === gridSize;
    const goingRight = dx === gridSize;
    const goingLeft = dx === -gridSize;

    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -gridSize;
        dy = 0;
    }

    if (keyPressed === UP_KEY && !goingDown) {
        dx = 0;
        dy = -gridSize;
    }

    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = gridSize;
        dy = 0;
    }

    if (keyPressed === DOWN_KEY && !goingUp) {
        dx = 0;
        dy = gridSize;
    }
}

function gameEnd() {
    for (let i = 4; i < snake.length; i++) {
        const collided = snake[i].x === snake[0].x && snake[i].y === snake[0].y;
        if (collided) return true;
    }

    const hitLeftWall = snake[0].x < 0;
    const hitRightWall = snake[0].x > gameSize - gridSize;
    const hitTopWall = snake[0].y < 0;
    const hitBottomWall = snake[0].y > gameSize - gridSize;

    return hitLeftWall || hitRightWall || hitTopWall || hitBottomWall;
}

function gameLoop() {
    if (gameEnd()) {
        gameOver();
        return;
    }

    changingDirection = false;
    clearCanvas();
    drawFood();
    advanceSnake();
    drawSnake();

    setTimeout(gameLoop, gameSpeed);
}

function startGame() {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameRunning = true;
    snake = [{x: 160, y: 160}, {x: 140, y: 160}, {x: 120, y: 160}, {x: 100, y: 160}];
    dx = gridSize;
    dy = 0;
    createFood();
    setTimeout(gameLoop, gameSpeed);
}

function gameOver() {
    gameRunning = false;
    gameOverScreen.style.display = 'block';
}

// Add tap event listener to start or restart the game
gameArea.addEventListener('click', () => {
    if (!gameRunning) {
        startGame();
    } else {
        gameOver();
        startGame();
    }
});

// Handle touch start for swipe direction
gameArea.addEventListener('touchstart', (e) => {
    e.preventDefault();  // Prevent default touch behavior (e.g., scrolling)
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

// Handle touch move for swipe gesture detection
gameArea.addEventListener('touchmove', (e) => {
    e.preventDefault();  // Prevent default touch behavior (e.g., scrolling)
    if (!gameRunning) return;

    let touchEndX = e.touches[0].clientX;
    let touchEndY = e.touches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Detect horizontal swipe (left or right)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && dx !== -gridSize) { // swipe right
            dx = gridSize;
            dy = 0;
        } else if (deltaX < 0 && dx !== gridSize) { // swipe left
            dx = -gridSize;
            dy = 0;
        }
    }
    // Detect vertical swipe (up or down)
    else {
        if (deltaY > 0 && dy !== -gridSize) { // swipe down
            dx = 0;
            dy = gridSize;
        } else if (deltaY < 0 && dy !== gridSize) { // swipe up
            dx = 0;
            dy = -gridSize;
        }
    }
});

// Initialize food for the first run
createFood();

// Initially show the start screen
startScreen.style.display = 'block';
