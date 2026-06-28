// =====================================================
// Forest Explorer
// Part 1 - Engine Setup
// =====================================================

// Canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Screen size
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

canvas.width = screenWidth;
canvas.height = screenHeight;

// Camera
const camera = {
    x: 0,
    y: 0,
    zoom: 1
};

// Player
const player = {
    x: 0,
    y: 0,

    speed: 3,

    radius: 12,

    color: "#ff9d00"
};

// Controls
const keys = {
    up:false,
    down:false,
    left:false,
    right:false
};

// Resize support
window.addEventListener("resize", () => {

    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    canvas.width = screenWidth;
    canvas.height = screenHeight;

});

// Keyboard controls (for testing on PC)

window.addEventListener("keydown",(e)=>{

    if(e.key==="w") keys.up=true;
    if(e.key==="s") keys.down=true;
    if(e.key==="a") keys.left=true;
    if(e.key==="d") keys.right=true;

});

window.addEventListener("keyup",(e)=>{

    if(e.key==="w") keys.up=false;
    if(e.key==="s") keys.down=false;
    if(e.key==="a") keys.left=false;
    if(e.key==="d") keys.right=false;

});
// =====================================================
// Update
// =====================================================

function update(){

    if(keys.up) player.y -= player.speed;
    if(keys.down) player.y += player.speed;
    if(keys.left) player.x -= player.speed;
    if(keys.right) player.x += player.speed;

    camera.x = player.x;
    camera.y = player.y;

}