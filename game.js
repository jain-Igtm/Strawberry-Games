const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let player = {
    x: 0,
    y: 0
};

function draw() {

    // Background
    ctx.fillStyle = "#3b6b2f";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Player
    ctx.fillStyle = "orange";

    ctx.beginPath();
    ctx.arc(
        canvas.width/2,
        canvas.height/2,
        12,
        0,
        Math.PI*2
    );
    ctx.fill();

    requestAnimationFrame(draw);
}

draw();